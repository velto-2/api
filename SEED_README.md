# Database Seed Scripts

## Setup

For MongoDB unique constraints to work, you need MongoDB running as a replica set.

### Option 1: MongoDB Atlas (Recommended for Production)
- Use MongoDB Atlas (free tier available)
- Already configured as replica set
- Update `MONGODB_URI` in `.env`

### Option 2: Local MongoDB Replica Set (Development)

**Quick Setup:**
```bash
# Run the setup script
./scripts/setup-mongodb-replica.sh
```

**Manual Setup:**
```bash
# 1. Stop current MongoDB (if running)
brew services stop mongodb-community

# 2. Start MongoDB as replica set
mongod --replSet rs0 --port 27017 --dbpath ~/data/db &

# 3. Initialize replica set
mongosh --eval "rs.initiate({_id: 'rs0', members: [{_id: 0, host: 'localhost:27017'}]})"
```

**Note:** If you get "already initialized" error, MongoDB is already set up. You can proceed with seeding.

### Option 3: Docker MongoDB Replica Set
```bash
docker run -d -p 27017:27017 --name mongodb \
  mongo:latest mongod --replSet rs0

docker exec -it mongodb mongosh --eval "rs.initiate()"
```

## Usage

### Seed Database
```bash
npm run seed
```

This will:
- Create all permissions
- Create system roles (Super Admin, Client Admin, Test Manager, Viewer)
- Create Velto internal organization
- Create super admin user
- Assign Super Admin role

**Default Admin Credentials:**
- Email: `admin@velto.ai` (or `SEED_ADMIN_EMAIL` env var)
- Password: `Admin123!` (or `SEED_ADMIN_PASSWORD` env var)

### Reset Database
```bash
npm run reset
```

Deletes all data (users, organizations, roles, permissions).

### Reset + Seed
```bash
npm run reset:seed
```

Resets database and seeds with initial data.

## Environment Variables

```env
SEED_ADMIN_EMAIL=admin@velto.ai
SEED_ADMIN_PASSWORD=Admin123!
```

