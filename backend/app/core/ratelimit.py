from slowapi import Limiter

from app.core.net import client_ip

# In-memory storage: fine for a single Render instance. For multiple instances,
# pass storage_uri="redis://..." here.
limiter = Limiter(key_func=client_ip, default_limits=["300/minute"])
