#!/bin/bash
# check_weights.sh

# 1. Activate Virtual Environment (if it exists)
if [ -d ".venv" ]; then
    source .venv/bin/activate
elif [ -d "venv" ]; then
    source venv/bin/activate
fi

# 2. Run the Python script
python show_admin_weights.py