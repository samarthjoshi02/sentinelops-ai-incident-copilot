import { FastifyInstance, FastifyPluginAsync, FastifyRequest, FastifyReply } from "fastify";
import fp from "fastify-plugin";
import { prisma } from "../../../../shared/db.js";
import { User } from "@prisma/client";

// Declare module to extend FastifyRequest type
declare module "fastify" {
  interface FastifyRequest {
    user?: User;
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

      // 2. Try checking Auth.js cookies
      const cookies = request.cookies;
      // Look for standard Auth.js session token names
      const sessionToken = 
        cookies["authjs.session-token"] || 
        cookies["__Secure-authjs.session-token"] ||
        cookies["next-auth.session-token"] ||
        cookies["__Secure-next-auth.session-token"];

      if (!sessionToken) {
        return reply.status(401).send({
          statusCode: 401,
          error: "Unauthorized",
          message: "Authentication credentials are missing."
        });
      }

      // Query database for the session
      const dbSession = await prisma.session.findUnique({
        where: { sessionToken },
        include: { user: true }
      });

      if (!dbSession || dbSession.expires < new Date()) {
        return reply.status(401).send({
          statusCode: 401,
          error: "Unauthorized",
          message: "Session is invalid or has expired."
        });
      }

      // Set user object on the request
      request.user = dbSession.user;
    } catch (error) {
      fastify.log.error("Authentication check error:", error);
      return reply.status(500).send({
        statusCode: 500,
        error: "Internal Server Error",
        message: "An error occurred during authentication verification."
      });
    }
  });
};

export default fp(authPlugin);
