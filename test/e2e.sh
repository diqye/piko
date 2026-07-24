#!/bin/bash

SOCK=~/piko/piko.sock
URL=http://localhost/piko

post() {
  curl -s -X POST --unix-socket "$SOCK" "$URL" \
    -H "Content-Type: application/json" \
    -d "$1"
  echo ""
  sleep "$2"
}

echo "=== Session 1: thinking ==="
post '{"sessionId":"s1","event":{"status":"thinking","name":"pi agent","sample":"Analyzing request"}}' 2
post '{"sessionId":"s1","event":{"status":"thinking","name":"pi agent","sample":" and other request Current directory: /Users/diqye/projects/typescript/piko/build/dev-macos-arm64/piko-dev.app/Contents/MacOS"}}' 2

echo "=== Session 1: working ==="
post '{"sessionId":"s1","event":{"status":"working","name":"pi agent","sample":"Editing\n hello \n src/index.ts"}}' 2
post '{"sessionId":"s1","event":{"status":"working","name":"pi agent","sample":"Server started at http://localhost:50000"}}' 2

echo "=== Session 2: thinking (multi-session) ==="
post '{"sessionId":"s2","event":{"status":"thinking","name":"claude code","sample":"Reading files..."}}' 2

echo "=== Session 2: working ==="
post '{"sessionId":"s2","event":{"status":"working","name":"claude code","sample":"Writing code..."}}' 2

echo "=== Session 1: idle (dequeue) ==="
post '{"sessionId":"s1","event":{"status":"idle","name":"pi agent"}}' 4

echo "=== Session 2: idle (dequeue, capsule returns to default) ==="
post '{"sessionId":"s2","event":{"status":"idle","name":"claude code"}}' 2

echo "=== Done ==="
