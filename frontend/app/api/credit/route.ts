import { NextRequest, NextResponse } from "next/server";
import { Pool } from "pg";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 20, // Maximum number of clients in the pool
  idleTimeoutMillis: 30000, // Close idle clients after 30 seconds
  connectionTimeoutMillis: 10000, // Return an error after 10 seconds if connection could not be established
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { admin_secret, model_creator, model_name, user_address } = body;

    if (admin_secret !== process.env.ADMIN_SECRET) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!model_creator || !user_address || !model_name) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const client = await pool.connect();

    // Ensure table exists (basic migration for this task)
    // await client.query(`
    //   CREATE TABLE IF NOT EXISTS kisses (
    //     user_id VARCHAR(96) PRIMARY KEY,
    //     kisses INTEGER DEFAULT 0
    //   );
    // `);

    try {
      await client.query("BEGIN");

      // Deduct 10 kisses from user
      const deductRes = await client.query(
        "UPDATE kisses SET kisses = kisses - 10 WHERE user_id = $1 RETURNING kisses",
        [user_address]
      );

      if (deductRes.rowCount === 0) {
        throw new Error("User not found");
      }

      if (deductRes.rows[0].kisses < 0) {
        throw new Error("Insufficient kisses");
      }

      // Add 2 kisses to creator
      const updateCreatorRes = await client.query(
        "UPDATE kisses SET kisses = kisses + 2 WHERE user_id = $1",
        [model_creator +"/"+ model_name]
      );

      if (updateCreatorRes.rowCount === 0) {
        await client.query(
          "INSERT INTO kisses (user_id, kisses) VALUES ($1, 2)",
          [model_creator + "/" + model_name]
        );
      }

      await client.query("COMMIT");

      return NextResponse.json({ success: true, message: "Transaction successful" });
    } catch (error: unknown) {
      await client.query("ROLLBACK");
      console.error("Transaction error:", error);
      const errorMessage = error instanceof Error ? error.message : "Transaction failed";
      return NextResponse.json({ error: errorMessage }, { status: 500 });
    } finally {
      client.release();
    }
  } catch (error) {
    console.error("API error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const user_id = searchParams.get("user_id");

    if (!user_id) {
      return NextResponse.json({ error: "Missing user_id" }, { status: 400 });
    }

    const client = await pool.connect();

    if (user_id === "/") {
      // Get all model creators (user_ids which contain "/")
      try {
        const res = await client.query(
          "SELECT user_id, kisses FROM kisses WHERE user_id LIKE '%/%' ORDER BY kisses DESC"
        );
        
        const result: Record<string, number> = {};
        for (const row of res.rows) {
          result[row.user_id] = row.kisses;
        }
        
        return NextResponse.json(result);
      } finally {
        client.release();
      }
    } else {
      try {
        const res = await client.query("SELECT kisses FROM kisses WHERE user_id = $1", [user_id]);
        
        if (res.rows.length === 0) {
          // First time user - initialize with 10 kisses
          await client.query("INSERT INTO kisses (user_id, kisses) VALUES ($1, 10)", [user_id]);
          return NextResponse.json({ kisses: 10 });
        }
        
        const kisses = res.rows[0].kisses;
        return NextResponse.json({ kisses });
      } finally {
        client.release();
      }
    }
  } catch (error) {
    console.error("API error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
