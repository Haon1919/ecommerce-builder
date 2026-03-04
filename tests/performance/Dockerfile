# Use the official k6 image as base
FROM grafana/k6:latest

# Set working directory inside the container
WORKDIR /tests

# Copy the performance scripts and package
COPY package.json /tests/
COPY scenarios /tests/scenarios

# Since we don't have heavy NPM dependencies (just types for IDE), we don't strictly need `npm install`.
# However, if we ever add k6 extensions or JS dependencies, we can install them here using a multi-stage node container.
# For now, K6 runs standalone scripts natively.

# Default command if no args provided (prints help).
# In Cloud Run Jobs, we will pass the args in the terraform definition.
CMD ["run", "--help"]
