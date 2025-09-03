import * as Joi from 'joi';

// Validación centralizada de variables de entorno
// CORS_ORIGINS es opcional (si no está, se usa modo dev "origin: true")
// JWT_SECRET y DOWNLOAD_TICKET_SECRET son obligatorias para prod (y dev también para testear rotación).
export default function envValidation(config: Record<string, unknown>) {
  const schema = Joi.object({
    NODE_ENV: Joi.string().valid('development', 'test', 'production').default('development'),
    PORT: Joi.number().port().default(3001),
    CORS_ORIGINS: Joi.string().optional(), // "https://app.example.com,https://admin.example.com"
    JWT_SECRET: Joi.string().min(24).required(),
    DOWNLOAD_TICKET_SECRET: Joi.string().min(24).required(),
  });

  const { error, value } = schema.validate(config, {
    abortEarly: false,
    allowUnknown: true,
    convert: true,
  });
  if (error) {
    // Unimos los mensajes para que sea claro qué falta
    throw new Error(`Invalid environment variables:\n${error.details.map(d => `- ${d.message}`).join('\n')}`);
  }
  return value;
}
