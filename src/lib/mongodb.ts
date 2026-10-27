import { MongoClient, Db } from "mongodb";

/**
 * MongoDB Singleton Client
 * -------------------------
 * Connects to mongodb://localhost:27017 → database "Retail-Database"
 *
 * Uses a global cache so Next.js hot-reloads in dev don't create
 * a new connection pool on every request.
 */

const MONGODB_URI = process.env.MONGODB_URI || "mongodb://localhost:27017";
const DB_NAME = process.env.MONGODB_DB || "Retail-Database";

// Cache the client promise in globalThis so it survives HMR in development
const globalWithMongo = globalThis as typeof globalThis & {
  _mongoClientPromise?: Promise<MongoClient>;
};

let clientPromise: Promise<MongoClient>;

if (process.env.NODE_ENV === "development") {
  // In dev, reuse the same promise across hot reloads
  if (!globalWithMongo._mongoClientPromise) {
    const client = new MongoClient(MONGODB_URI);
    globalWithMongo._mongoClientPromise = client.connect();
  }
  clientPromise = globalWithMongo._mongoClientPromise;
} else {
  // In production, create a fresh client
  const client = new MongoClient(MONGODB_URI);
  clientPromise = client.connect();
}

/**
 * Get a connected database handle.
 * Safe to call on every request — the underlying connection is pooled.
 */
export async function getDb(): Promise<Db> {
  const client = await clientPromise;
  return client.db(DB_NAME);
}

export { clientPromise };
