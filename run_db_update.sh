#!/bin/bash
echo "Updating Database Structure..."
source .venv/bin/activate  # Or whatever command activates your env
python migrate_weights.py
echo "Done."