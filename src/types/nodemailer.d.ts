// Next.js's build-time type checker fails to resolve @types/nodemailer's declarations
// in some environments even though `tsc --noEmit` resolves them fine (verified). This
// ambient shim is the workaround Next's own error message suggests, scoped to just this
// one module rather than disabling type-checking project-wide.
declare module "nodemailer";
