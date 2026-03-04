#!/usr/bin/env bash

# Exit immediately if a command exits with a non-zero status
set -e

echo "=================================================="
echo "Running Local Security Audit (Trivy)"
echo "=================================================="

# Check if Trivy is installed
if ! command -v trivy &> /dev/null; then
    echo "Error: 'trivy' could not be found."
    echo ""
    echo "Please install Trivy to run the local security audit."
    echo "Installation instructions:"
    echo "  macOS (Homebrew): brew install trivy"
    echo "  Linux (Debian/Ubuntu): apt-get install trivy"
    echo "  Other: https://aquasecurity.github.io/trivy/latest/getting-started/installation/"
    echo ""
    exit 1
fi

echo "Scanning repository for vulnerabilities..."
echo ""

# Run the Trivy filesystem scan
# Matches the GitHub Actions configuration:
# - scan-type: 'fs'
# - format: 'table'
# - exit-code: '1'
# - severity: 'CRITICAL,HIGH'
trivy fs . \
    --format table \
    --exit-code 1 \
    --severity CRITICAL,HIGH \
    --scanners vuln \
    --ignore-unfixed

echo ""
echo "✅ Security audit passed! No CRITICAL or HIGH vulnerabilities found."
echo "=================================================="
