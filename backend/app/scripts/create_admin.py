"""Generate admin credentials for env vars.

    python -m app.scripts.create_admin

Prints ADMIN_PASSWORD_HASH and a fresh ADMIN_TOTP_SECRET plus an otpauth:// URI for your
authenticator app. Paste the values into Render → Environment. Nothing is written to disk or the DB.
"""

import getpass
import secrets
import sys

import pyotp

from app.core.security import hash_password


def main() -> None:
    username = input("Admin username [admin]: ").strip() or "admin"
    pw = getpass.getpass("Admin password (min 14 chars): ")
    if len(pw) < 14:
        sys.exit("Password too short.")
    if pw != getpass.getpass("Repeat password: "):
        sys.exit("Passwords do not match.")
    totp_secret = pyotp.random_base32()
    uri = pyotp.TOTP(totp_secret).provisioning_uri(name=username, issuer_name="XotiicTech")

    print("\n# ---- add these to your backend environment ----")
    print(f"ADMIN_USERNAME={username}")
    print(f"ADMIN_PASSWORD_HASH='{hash_password(pw)}'")
    print(f"ADMIN_TOTP_SECRET={totp_secret}")
    print("\n# Add to your authenticator app (Google Authenticator, 1Password, Aegis...):")
    print(f"#   manual key: {totp_secret}")
    print(f"#   or URI:     {uri}")
    print("\n# Optional - a fresh SECRET_KEY if you need one:")
    print(f"SECRET_KEY={secrets.token_urlsafe(48)}")


if __name__ == "__main__":
    main()
