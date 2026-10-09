import type { FastifyInstance } from "fastify";
import type { HttpErrorMapper } from "./HttpErrorMapper.js";

// Every error and unknown route leaves the api as {error, message}; 5xx are logged with the request id.
export class ErrorHandlerInstaller {
  readonly #mapper: HttpErrorMapper;

  constructor(mapper: HttpErrorMapper) {
    this.#mapper = mapper;
  }

  install(app: FastifyInstance): void {
    app.setErrorHandler(async (error, request, reply) => {
      const response = this.#mapper.map(error);
      if (response.status >= 500) {
        request.log.error({ error }, "request failed");
      }
      return reply.status(response.status).send(response.body);
    });
    app.setNotFoundHandler(async (request, reply) => {
      const message = `No route for ${request.method} ${request.url}`;
      return reply.status(404).send({ error: "not_found", message });
    });
  }
}
