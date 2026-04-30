<p align="center">
  <a href="http://nestjs.com/" target="blank"><img src="https://nestjs.com/img/logo-small.svg" width="120" alt="Nest Logo" /></a>
</p>

[circleci-image]: https://img.shields.io/circleci/build/github/nestjs/nest/master?token=abc123def456
[circleci-url]: https://circleci.com/gh/nestjs/nest

  <p align="center">A progressive <a href="http://nodejs.org" target="_blank">Node.js</a> framework for building efficient and scalable server-side applications.</p>
    <p align="center">
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/v/@nestjs/core.svg" alt="NPM Version" /></a>
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/l/@nestjs/core.svg" alt="Package License" /></a>
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/dm/@nestjs/common.svg" alt="NPM Downloads" /></a>
<a href="https://circleci.com/gh/nestjs/nest" target="_blank"><img src="https://img.shields.io/circleci/build/github/nestjs/nest/master" alt="CircleCI" /></a>
<a href="https://discord.gg/G7Qnnhy" target="_blank"><img src="https://img.shields.io/badge/discord-online-brightgreen.svg" alt="Discord"/></a>
<a href="https://opencollective.com/nest#backer" target="_blank"><img src="https://opencollective.com/nest/backers/badge.svg" alt="Backers on Open Collective" /></a>
<a href="https://opencollective.com/nest#sponsor" target="_blank"><img src="https://opencollective.com/nest/sponsors/badge.svg" alt="Sponsors on Open Collective" /></a>
  <a href="https://paypal.me/kamilmysliwiec" target="_blank"><img src="https://img.shields.io/badge/Donate-PayPal-ff3f59.svg" alt="Donate us"/></a>
    <a href="https://opencollective.com/nest#sponsor"  target="_blank"><img src="https://img.shields.io/badge/Support%20us-Open%20Collective-41B883.svg" alt="Support us"></a>
  <a href="https://twitter.com/nestframework" target="_blank"><img src="https://img.shields.io/twitter/follow/nestframework.svg?style=social&label=Follow" alt="Follow us on Twitter"></a>
</p>
  <!--[![Backers on Open Collective](https://opencollective.com/nest/backers/badge.svg)](https://opencollective.com/nest#backer)
  [![Sponsors on Open Collective](https://opencollective.com/nest/sponsors/badge.svg)](https://opencollective.com/nest#sponsor)-->

## Description

[Nest](https://github.com/nestjs/nest) framework TypeScript starter repository.

## Project setup

```bash
$ npm install
```

## Compile and run the project

```bash
# development
$ npm run start

# watch mode
$ npm run start:dev

# production mode
$ npm run start:prod
```

## Google OAuth (Passport) test flow

This project uses Passport Google strategy endpoints:

- `GET /auth/oauth/google` (starts Google consent redirect)
- `GET /auth/oauth/google/passport/callback` (Google callback, returns token pair JSON)

Quick test steps:

1. Start server and open Swagger UI.
2. Call `GET /auth/oauth/google` from Swagger (or open it directly in browser).
3. Complete Google login/consent.
4. You will be redirected to `GET /auth/oauth/google/passport/callback` and receive access/refresh tokens as JSON.

Required env vars:

- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- Optional: `GOOGLE_CALLBACK_URL` (default: `http://localhost:3000/auth/oauth/google/passport/callback`)

## Development with Docker

1. Create your local env file from template:

```bash
cp .env.example .env
```

2. Fill in real GCP VM PostgreSQL credentials in `.env`.

3. Build and run the development container:

```bash
npm run docker:dev:build
npm run docker:dev
```

4. Stop container:

```bash
npm run docker:dev:down
```

## Run tests

```bash
# unit tests
$ npm run test

# e2e tests
$ npm run test:e2e

# test coverage
$ npm run test:cov
```

## Deployment (Single GCP VM)

This setup assumes the app and PostgreSQL both run on the same GCP VM.

This repository includes:

- `Dockerfile` for production container image
- `.dockerignore` for lean builds
- `cloudbuild.yaml` for Cloud Build if you still want image builds

### 1. Prerequisites

- Install and authenticate Google Cloud CLI
- Set a project:

```bash
gcloud config set project YOUR_PROJECT_ID
```

### 2. Install PostgreSQL on the VM

Install PostgreSQL on the VM and create a database plus user for the app.

Example connection string for the same machine:

```bash
postgresql://app_user:YOUR_PASSWORD@localhost:5432/snappy?schema=public
```

### 3. Set environment variables on the VM

Put the app and Prisma URLs in the VM's `.env` file:

```bash
DATABASE_URL='postgresql://app_user:YOUR_PASSWORD@localhost:5432/snappy?schema=public'
DIRECT_URL='postgresql://app_user:YOUR_PASSWORD@localhost:5432/snappy?schema=public'
```

### 4. Run migrations

```bash
npm run prisma:migrate:deploy
```

### 5. Start the app

Run the Nest app on the same VM after PostgreSQL is up:

```bash
npm run start:prod
```

Because the app and database are on the same VM, do not expose port `5432` publicly unless you really need to.

## Resources

Check out a few resources that may come in handy when working with NestJS:

- Visit the [NestJS Documentation](https://docs.nestjs.com) to learn more about the framework.
- For questions and support, please visit our [Discord channel](https://discord.gg/G7Qnnhy).
- To dive deeper and get more hands-on experience, check out our official video [courses](https://courses.nestjs.com/).
- Deploy your application to AWS with the help of [NestJS Mau](https://mau.nestjs.com) in just a few clicks.
- Visualize your application graph and interact with the NestJS application in real-time using [NestJS Devtools](https://devtools.nestjs.com).
- Need help with your project (part-time to full-time)? Check out our official [enterprise support](https://enterprise.nestjs.com).
- To stay in the loop and get updates, follow us on [X](https://x.com/nestframework) and [LinkedIn](https://linkedin.com/company/nestjs).
- Looking for a job, or have a job to offer? Check out our official [Jobs board](https://jobs.nestjs.com).

## Support

Nest is an MIT-licensed open source project. It can grow thanks to the sponsors and support by the amazing backers. If you'd like to join them, please [read more here](https://docs.nestjs.com/support).

## Stay in touch

- Author - [Kamil Myśliwiec](https://twitter.com/kammysliwiec)
- Website - [https://nestjs.com](https://nestjs.com/)
- Twitter - [@nestframework](https://twitter.com/nestframework)

## License

Nest is [MIT licensed](https://github.com/nestjs/nest/blob/master/LICENSE).
