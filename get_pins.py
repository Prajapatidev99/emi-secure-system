import ssl
import socket
from cryptography import x509
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.serialization import Encoding, PublicFormat
import base64

hostname = 'emi-secure-system.onrender.com'
port = 443

ctx = ssl.create_default_context()
with socket.create_connection((hostname, port)) as sock:
    with ctx.wrap_socket(sock, server_hostname=hostname) as ssock:
        der_certs = ssock.getpeercert(binary_form=True) # This is only the leaf cert
        # Unfortunately, standard ssl library only returns the leaf cert easily in Python without openSSL bindings.
