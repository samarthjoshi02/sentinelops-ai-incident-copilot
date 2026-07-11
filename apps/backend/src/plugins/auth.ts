import { FastifyInstance, FastifyPluginAsync, FastifyRequest, FastifyReply } from "fastify";
import fp from "fastify-plugin";
import { prisma } from "../../../../shared/db.js";
import { User } from "@prisma/client";

// Declare module to extend FastifyRequest and FastifyInstance types
declare module "fastify" {
  interface FastifyRequest {
    user?: User;
  }
  interface FastifyInstance {
    authenticate: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
}

const authPlugin: FastifyPluginAsync = async (fastify: FastifyInstance) => {
  // Decorator to protect routes
  fastify.decorate("authenticate", async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      // 1. Try checking for Authorization header first (for CLI / script tests)
      const authHeader = request.headers.authorization;
      if (authHeader && authHeader.startsWith("Bearer ")) {
        const token = authHeader.substring(7);
        const expectedToken = (process.env.AUTH_SECRET || "").replace(/^["']|["']$/g, "");
        
        if (token === expectedToken && expectedToken.length > 0) {
          // Authenticate as a system admin
          // Find first Admin or create one / fetch first user
          let systemUser = await prisma.user.findFirst({
            where: { role: "ADMIN" }
          });
          
          if (!systemUser) {
            systemUser = await prisma.user.findFirst();
          }
          
          if (!systemUser) {
            systemUser = await prisma.user.create({
              data: {
                name: "System Administrator",
                email: "admin@sentinelops.ai",
                role: "ADMIN"
              }
            });
          }
          
          if (systemUser) {
            request.user = systemUser;
            return;
          }
        }
      }

      // 2. Verify Auth.js cookies via Next.js session API
      // Since NextAuth uses JWT strategy with the Credentials provider, session tokens are encrypted 
      // and not stored in the database. We forward the cookie to the Next.js endpoint to validate.
      const cookieHeader = request.headers.cookie;
      if (!cookieHeader) {
        return reply.status(401).send({
          statusCode: 401,
          error: "Unauthorized",
          message: "Authentication credentials are missing."
        });
      }

      const frontendUrl = process.env.FRONTEND_URL || "http://localhost:3000";
      const sessionRes = await fetch(`${frontendUrl}/api/auth/session`, {
        headers: { cookie: cookieHeader }
      });

      if (!sessionRes.ok) {
        return reply.status(401).send({
          statusCode: 401,
          error: "Unauthorized",
          message: "Failed to communicate with authentication server."
        });
      }

      const sessionData = await sessionRes.json();

      if (!sessionData || !sessionData.user || !sessionData.user.email) {
        return reply.status(401).send({
          statusCode: 401,
          error: "Unauthorized",
          message: "Session is invalid or has expired."
        });
      }

      // Fetch the full user from database
      const dbUser = await prisma.user.findUnique({
        where: { email: sessionData.user.email }
      });

      if (!dbUser) {
        return reply.status(401).send({
          statusCode: 401,
          error: "Unauthorized",
          message: "User associated with session not found in database."
        });
      }

      // Set user object on the request
      request.user = dbUser;
    } catch (error) {
      fastify.log.error({ err: error }, "Authentication check error");
      return reply.status(500).send({
        statusCode: 500,
        error: "Internal Server Error",
        message: "An error occurred during authentication verification."
      });
    }
  });
};

export default fp(authPlugin);
