"""Apply the minimal headless-router adaptation to a pinned OpenRad checkout."""

import argparse
from pathlib import Path

UPSTREAM_COMMIT = "c7111577ffdfb4ab48ef4ba108ddbcf3ca07795c"


def replace_once(path: Path, before: str, after: str) -> None:
    text = path.read_text(encoding="utf-8")
    if after in text:
        return
    if text.count(before) != 1:
        raise RuntimeError(f"Unexpected upstream source at {path}")
    path.write_text(text.replace(before, after), encoding="utf-8", newline="\n")


def prepare(source: Path) -> None:
    replace_once(
        source / "Cargo.toml",
        '[dependencies]\n',
        '[features]\nrouter-headless = []\n\n[dependencies]\n',
    )
    # The router uses a new, isolated private-file identity profile. No desktop
    # credential store is installed. Existing file identities still prevent init.
    replace_once(
        source / "src/main.rs",
        '                source.is_some()\n            )?,',
        '                source.is_some() || cfg!(feature = "router-headless")\n            )?,',
    )
    # musl uses narrower msghdr/cmsghdr length members than glibc. The buffers
    # here contain a small, bounded number of descriptors; infer field types on
    # assignment and use usize for pointer arithmetic after receiving them.
    replacements = {
        "msg.msg_controllen = std::mem::size_of_val(&control);":
            "msg.msg_controllen = std::mem::size_of_val(&control) as _;",
        "msg.msg_controllen = libc::CMSG_SPACE(fd_size) as usize;":
            "msg.msg_controllen = libc::CMSG_SPACE(fd_size) as _;",
        "(*c).cmsg_len = libc::CMSG_LEN(fd_size) as usize;":
            "(*c).cmsg_len = libc::CMSG_LEN(fd_size) as _;",
        "unsafe { libc::CMSG_SPACE(std::mem::size_of::<RawFd>() as u32) } as usize;":
            "unsafe { libc::CMSG_SPACE(std::mem::size_of::<RawFd>() as u32) } as _;",
        "libc::CMSG_LEN(std::mem::size_of::<RawFd>() as u32) as usize;":
            "libc::CMSG_LEN(std::mem::size_of::<RawFd>() as u32) as _;",
        "(*c).cmsg_len.saturating_sub(libc::CMSG_LEN(0) as usize)":
            "((*c).cmsg_len as usize).saturating_sub(libc::CMSG_LEN(0) as usize)",
        "message.msg_iovlen = parts.len();":
            "message.msg_iovlen = parts.len() as _;",
        "msg.msg_controllen = size;": "msg.msg_controllen = size as _;",
        "libc::CMSG_LEN((count * std::mem::size_of::<RawFd>()) as u32) as usize;":
            "libc::CMSG_LEN((count * std::mem::size_of::<RawFd>()) as u32) as _;",
        ", TUNGETIFF,": ", TUNGETIFF as _,",
        ", TUNSETIFF,": ", TUNSETIFF as _,",
        ", TUNSETOWNER,": ", TUNSETOWNER as _,",
    }
    for rel in ("src/daemon.rs", "src/platform/linux.rs", "src/udp.rs"):
        path = source / rel
        text = path.read_text(encoding="utf-8")
        for before, after in replacements.items():
            text = text.replace(before, after)
        path.write_text(text, encoding="utf-8", newline="\n")
    replace_once(
        source / "src/udp.rs",
        'pub(crate) fn bind_dual_stack() -> std::io::Result<UdpSocket> {\n',
        '''pub(crate) fn bind_dual_stack() -> std::io::Result<UdpSocket> {
    // Optional bounded port pool for explicit router/NAT port forwarding.
    // Ordinary upstream builds retain ephemeral ports.
    #[cfg(all(feature = "router-headless", target_os = "linux"))]
    if let Some(value) = std::env::var_os("OPENRAD_UDP_PORT_RANGE") {
        use std::io::{Error, ErrorKind};
        let invalid = || Error::new(ErrorKind::InvalidInput, "invalid OPENRAD_UDP_PORT_RANGE");
        let value = value.to_str().ok_or_else(invalid)?;
        let (first, last) = value.split_once('-').ok_or_else(invalid)?;
        let first: u16 = first.parse().map_err(|_| invalid())?;
        let last: u16 = last.parse().map_err(|_| invalid())?;
        if first < 1024 || last < first || last - first >= 64 {
            return Err(invalid());
        }
        for port in first..=last {
            match UdpSocket::bind((std::net::Ipv6Addr::UNSPECIFIED, port)) {
                Ok(socket) => return Ok(socket),
                Err(error) if error.kind() == ErrorKind::AddrInUse => continue,
                Err(error) => return Err(error),
            }
        }
        return Err(Error::new(ErrorKind::AddrInUse, "OpenRad UDP port pool exhausted"));
    }
''',
    )
    print(f"Prepared OpenRad router CLI; upstream {UPSTREAM_COMMIT}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("source", type=Path)
    prepare(parser.parse_args().source)
