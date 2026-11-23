"""Temporary authenticated SMB share for building the Linux SDK on the target."""
import json
from pathlib import Path

from impacket import smbserver
from impacket.ntlm import compute_lmhash, compute_nthash


workspace = Path(__file__).resolve().parents[1]
credentials = json.loads((workspace / "dist" / ".sdk_smb_credentials.json").read_text(encoding="utf-8"))
share = workspace / "dist" / "sdk"
server = smbserver.SimpleSMBServer(listenAddress="192.168.100.173", listenPort=1445)
server.addShare("SDK", str(share), "Temporary TerryClash SDK build", readOnly="no")
server.setSMB2Support(True)
server.addCredential("tcsdk", 0, compute_lmhash(credentials["password"]), compute_nthash(credentials["password"]))
server.start()
