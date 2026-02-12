#!/bin/bash
PORT=8080
echo "Serving at http://localhost:$PORT"

if command -v xdg-open &>/dev/null; then
  xdg-open "http://localhost:$PORT" &
elif command -v open &>/dev/null; then
  open "http://localhost:$PORT" &
fi

python3 -m http.server "$PORT"
