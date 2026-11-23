"""Complete outgoing TCP rendezvous for the pinned router prototype."""

from pathlib import Path


def apply(source: Path, replace_once) -> None:
    replace_once(
        source / "Cargo.toml",
        "[target.'cfg(windows)'.dependencies]\n",
        "[target.'cfg(unix)'.dependencies]\nsocket2 = { version = \"0.6\", features = [\"all\"] }\n\n[target.'cfg(windows)'.dependencies]\n",
    )
    session = source / "src/session.rs"
    replace_once(
        session,
        '''    pub fn connect_with_stop(
''',
        '''    pub(crate) fn listen_shared(port: u16) -> Result<std::net::TcpListener> {
        let socket = socket2::Socket::new(socket2::Domain::IPV6, socket2::Type::STREAM, None)?;
        socket.set_only_v6(false)?;
        socket.set_reuse_address(true)?;
        #[cfg(target_os = "linux")]
        socket.set_reuse_port(true)?;
        socket.bind(&std::net::SocketAddr::new(std::net::Ipv6Addr::UNSPECIFIED.into(), port).into())?;
        socket.listen(8)?;
        Ok(socket.into())
    }
    pub(crate) fn connect_bound(
        address: &std::net::SocketAddr,
        local_port: u16,
        duration: Duration,
        stop: Option<Arc<AtomicBool>>,
        timeout: Duration,
    ) -> Result<Self> {
        #[cfg(target_os = "linux")]
        let socket = connect_socket_from_port(address, timeout, &stop, Some(local_port))?;
        #[cfg(not(target_os = "linux"))]
        let socket = connect_socket(address, timeout, &stop)?;
        Self::from_socket(socket, duration, stop)
    }
    pub fn connect_with_stop(
''',
    )
    replace_once(
        session,
        '''    use std::os::fd::{AsRawFd, FromRawFd, OwnedFd};
    ensure!(!timeout.is_zero(), "TCP connect timeout");''',
        '''    connect_socket_from_port(address, timeout, stop, None)
}

#[cfg(target_os = "linux")]
fn connect_socket_from_port(
    address: &std::net::SocketAddr,
    timeout: Duration,
    stop: &Option<Arc<AtomicBool>>,
    local_port: Option<u16>,
) -> Result<TcpStream> {
    use std::os::fd::{AsRawFd, FromRawFd, OwnedFd};
    ensure!(!timeout.is_zero(), "TCP connect timeout");''',
    )
    replace_once(
        session,
        '''    let fd = unsafe { OwnedFd::from_raw_fd(raw) };
    let connected = match address {''',
        '''    let fd = unsafe { OwnedFd::from_raw_fd(raw) };
    // Official clients reuse the coordinator source port for listening and
    // peer SYNs. Both the existing connection and listener must permit reuse.
    if cfg!(feature = "router-headless") || local_port.is_some() {
        let enabled: libc::c_int = 1;
        let rc = unsafe {
            libc::setsockopt(fd.as_raw_fd(), libc::SOL_SOCKET, libc::SO_REUSEADDR,
                (&enabled as *const libc::c_int).cast(), std::mem::size_of_val(&enabled) as _)
        };
        ensure!(rc == 0, "TCP SO_REUSEADDR: {}", io::Error::last_os_error());
        let rc = unsafe {
            libc::setsockopt(fd.as_raw_fd(), libc::SOL_SOCKET, libc::SO_REUSEPORT,
                (&enabled as *const libc::c_int).cast(), std::mem::size_of_val(&enabled) as _)
        };
        ensure!(rc == 0, "TCP SO_REUSEPORT: {}", io::Error::last_os_error());
    }
    if let Some(port) = local_port {
        ensure!(port >= 1024, "invalid rendezvous source port");
        let rc = if address.is_ipv4() {
            let mut bound: libc::sockaddr_in = unsafe { std::mem::zeroed() };
            bound.sin_family = libc::AF_INET as _;
            bound.sin_port = port.to_be();
            unsafe { libc::bind(fd.as_raw_fd(), (&bound as *const libc::sockaddr_in).cast(),
                std::mem::size_of_val(&bound) as _) }
        } else {
            let mut bound: libc::sockaddr_in6 = unsafe { std::mem::zeroed() };
            bound.sin6_family = libc::AF_INET6 as _;
            bound.sin6_port = port.to_be();
            unsafe { libc::bind(fd.as_raw_fd(), (&bound as *const libc::sockaddr_in6).cast(),
                std::mem::size_of_val(&bound) as _) }
        };
        ensure!(rc == 0, "TCP rendezvous bind: {}", io::Error::last_os_error());
    }
    let connected = match address {''',
    )
    peer = source / "src/peer.rs"
    replace_once(
        peer,
        '''                                            let mut stream = Framed::connect_timeout(
                                                &candidate.endpoint.ip().to_string(),
                                                candidate.endpoint.port(),
                                                deadline
                                                    .saturating_duration_since(Instant::now())
                                                    .min(Duration::from_secs(3)),
                                                Some(cancel.clone()),
                                                Duration::from_secs(2),
                                            )?;''',
        '''                                            let budget = deadline.saturating_duration_since(Instant::now())
                                                .min(Duration::from_secs(3));
                                            let mut stream = if cfg!(all(feature = "router-headless", target_os = "linux")) {
                                                Framed::connect_bound(&candidate.endpoint, rendezvous_port,
                                                    budget, Some(cancel.clone()), Duration::from_secs(2))?
                                            } else {
                                                Framed::connect_timeout(&candidate.endpoint.ip().to_string(),
                                                    candidate.endpoint.port(), budget, Some(cancel.clone()), Duration::from_secs(2))?
                                            };''',
    )
    replace_once(
        peer,
        '''        let route_ip = coord.stream.socket.local_addr()?.ip();
''',
        '''        let route_ip = coord.stream.socket.local_addr()?.ip();
        let rendezvous_port = coord.stream.socket.local_addr()?.port();
''',
    )
    replace_once(
        peer,
        '''                        pending = Some((cid, password));
                        if !force_relay {''',
        '''                        pending = Some((cid, password));
                        if !force_relay && cfg!(all(feature = "router-headless", target_os = "linux")) {
                            let listener = Framed::listen_shared(rendezvous_port)?;
                            listener.set_nonblocking(true)?;
                            let addresses = crate::udp::local_candidates(route_ip, rendezvous_port)?;
                            coord.send(&advertise_tcp(cid, &addresses)?)?;
                            report.attempts.push(serde_json::json!({
                                "phase":"outgoing_tcp_listener", "port":rendezvous_port,
                                "candidates":addresses.len(),
                            }));
                            let dial = PeerDial {
                                identity, own_ip, peer: peer.clone(),
                                password: pending.as_ref().unwrap().1.clone(), reports,
                            };
                            let tracker = progress.tracker();
                            let peer_rid = peer.rid;
                            tasks.spawn(scope, "direct-tcp-listener", move |cancel| {
                                let mut admitted = 0;
                                let mut errors = Vec::new();
                                while Instant::now() < until && !cancel.load(std::sync::atomic::Ordering::Relaxed) {
                                    match listener.accept() {
                                        Ok((socket, _)) => {
                                            admitted += 1;
                                            ensure!(admitted <= 8, "TCP rendezvous admission limit");
                                            let result = (|| {
                                                let mut stream = Framed::from_socket(socket, Duration::from_secs(3), Some(cancel.clone()))?;
                                                stream.accept_rendezvous(peer_rid, cid)?;
                                                tracker.mark();
                                                let stream = Framed::from_socket(stream.into_socket()?, Duration::from_secs(10), Some(cancel.clone()))?;
                                                dial.authenticate(PeerStream::Tcp(stream), TransportPath::DirectTcp, "direct-tcp-listener")
                                            })();
                                            match result {
                                                Ok(channel) => return Ok(channel),
                                                Err(error) => errors.push(format!("{error:#}")),
                                            }
                                        }
                                        Err(error) if error.kind() == std::io::ErrorKind::WouldBlock =>
                                            std::thread::sleep(Duration::from_millis(10)),
                                        Err(error) => return Err(error.into()),
                                    }
                                }
                                bail!("TCP listener ended: {}", errors.join("; "))
                            })?;
                        }
                        if !force_relay {''',
    )
