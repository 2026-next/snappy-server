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

## Development with Docker

1. Create your local env file from template:

```bash
cp .env.example .env
```

2. Fill in real Supabase credentials in `.env`.

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

## Deployment (GCP Cloud Run)

This repository includes:

- `Dockerfile` for production container image
- `.dockerignore` for lean builds
- `cloudbuild.yaml` for build + deploy via Cloud Build

### 1. Prerequisites

- Install and authenticate Google Cloud CLI
- Set a project:

```bash
gcloud config set project YOUR_PROJECT_ID
```

- Enable APIs:

```bash
gcloud services enable run.googleapis.com cloudbuild.googleapis.com artifactregistry.googleapis.com secretmanager.googleapis.com
```

### 2. Get your Supabase connection string

In Supabase Dashboard:

- Open your project
- Go to `Project Settings` -> `Database`
- Copy `Connection string` (Transaction pooler is recommended)
- Ensure it includes `sslmode=require`

Example format:

```bash
postgresql://postgres.PROJECT_REF:YOUR_PASSWORD@aws-0-ap-northeast-2.pooler.supabase.com:6543/postgres?sslmode=require
```

### 3. Create `DATABASE_URL` secret in GCP

```bash
echo -n 'postgresql://postgres.PROJECT_REF:YOUR_PASSWORD@aws-0-ap-northeast-2.pooler.supabase.com:6543/postgres?sslmode=require' \
  | gcloud secrets create snappy-database-url --data-file=-
```

If the secret already exists, add a new version:

```bash
echo -n 'postgresql://postgres.PROJECT_REF:YOUR_PASSWORD@aws-0-ap-northeast-2.pooler.supabase.com:6543/postgres?sslmode=require' \
  | gcloud secrets versions add snappy-database-url --data-file=-
```

Allow Cloud Run runtime service account to read the secret:

```bash
PROJECT_NUMBER=$(gcloud projects describe YOUR_PROJECT_ID --format='value(projectNumber)')
gcloud secrets add-iam-policy-binding snappy-database-url \
  --member="serviceAccount:${PROJECT_NUMBER}-compute@developer.gserviceaccount.com" \
  --role='roles/secretmanager.secretAccessor'
```

### 4. Deploy with Cloud Build

```bash
gcloud builds submit --config cloudbuild.yaml \
  --substitutions=_SERVICE_NAME=snappy-server,_REGION=asia-northeast3,_DATABASE_URL_SECRET=snappy-database-url
```

### 5. Run Prisma migrations against Supabase

```bash
DATABASE_URL='postgresql://postgres.PROJECT_REF:YOUR_PASSWORD@aws-0-ap-northeast-2.pooler.supabase.com:6543/postgres?sslmode=require' \
npm run prisma:migrate:deploy
```

Tip: For migrations, if your pooler blocks DDL operations, use Supabase direct database port `5432` URL only for migration commands.

Recommended env split:

- `DATABASE_URL`: Supabase pooler (`6543`) for app runtime
- `DIRECT_URL`: Supabase direct (`5432`) for migration commands

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
