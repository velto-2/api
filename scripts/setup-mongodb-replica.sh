#!/bin/bash

echo "🔧 Setting up MongoDB replica set for development..."

# Check if MongoDB is running
if pgrep -x "mongod" > /dev/null; then
  echo "⚠️  MongoDB is already running. Stopping it..."
  brew services stop mongodb-community 2>/dev/null || pkill mongod
  sleep 2
fi

# Start MongoDB with replica set
echo "🚀 Starting MongoDB with replica set..."
mongod --replSet rs0 --port 27017 --dbpath ~/data/db 2>/dev/null &
MONGO_PID=$!
sleep 3

# Initialize replica set
echo "📋 Initializing replica set..."
mongosh --eval "rs.initiate({_id: 'rs0', members: [{_id: 0, host: 'localhost:27017'}]})" --quiet

if [ $? -eq 0 ]; then
  echo "✅ MongoDB replica set initialized!"
  echo "💡 MongoDB is running in background (PID: $MONGO_PID)"
  echo "💡 To stop: kill $MONGO_PID or pkill mongod"
else
  echo "❌ Failed to initialize replica set"
  kill $MONGO_PID 2>/dev/null
  exit 1
fi

