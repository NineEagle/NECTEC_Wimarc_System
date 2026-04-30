#!/bin/bash
# Run this once to set up SSH key authentication
# After this, start.sh will work without password prompts

SERVER="opas@203.185.101.161"

echo "=== Setting up SSH key for $SERVER ==="

# Generate key if not exists
if [ ! -f ~/.ssh/wimarc_key ]; then
    echo "Generating SSH key..."
    ssh-keygen -t rsa -b 4096 -f ~/.ssh/wimarc_key -N "" -C "wimarc"
    echo "Key generated."
else
    echo "SSH key already exists."
fi

# Copy public key to server (enter password: wimarc@nectec)
echo ""
echo "Copying key to server — enter password: wimarc@nectec"
ssh-copy-id -i ~/.ssh/wimarc_key.pub -o StrictHostKeyChecking=no "$SERVER"

echo ""
echo "Done! You can now run ./start.sh without entering a password."
