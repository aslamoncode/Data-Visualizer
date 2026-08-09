# ==========================================
# CloudViz Backend — Dockerfile
#
# Containerizes the Flask API so it can be
# built and run identically on any machine
# (local dev, Render, or any other cloud
# provider) — this is what makes "Docker" a
# genuine, demonstrable skill for this project
# rather than just a buzzword.
# ==========================================

# Use a slim, official Python base image.
# Slim = smaller image size, faster builds/deploys,
# smaller attack surface than the full python image.
FROM python:3.11-slim

# Set the working directory inside the container.
# All subsequent commands run relative to this path.
WORKDIR /app

# Copy only the requirements file first (not the whole
# codebase yet). This is a deliberate Docker best
# practice: Docker caches each layer, so if your code
# changes but requirements.txt doesn't, this dependency
# install step gets skipped on rebuild — much faster
# iteration during development.
COPY requirements.txt .

# Install Python dependencies inside the container.
# --no-cache-dir keeps the final image smaller by not
# storing pip's download cache.
RUN pip install --no-cache-dir -r requirements.txt

# Now copy the rest of the application code.
COPY . .

# Document which port the app listens on inside the
# container. This is informational for humans/tools
# reading the Dockerfile — Render still uses its own
# PORT environment variable at runtime (handled in
# app.py already).
EXPOSE 10000

# Start the app using gunicorn, the same production
# WSGI server we already use outside Docker. Binding
# explicitly to 0.0.0.0 and Render's $PORT env var
# (with a safe fallback) so it works both on Render
# and if you ever run this container anywhere else.
CMD gunicorn app:app --bind 0.0.0.0:${PORT:-10000}