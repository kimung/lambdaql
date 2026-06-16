---
layout: home

hero:
  name: "LambdaQL"
  text: "Type-safe SQL with lambda expressions"
  tagline: Write queries as TypeScript arrow functions — no string SQL, no DSL to learn.
  actions:
    - theme: brand
      text: Get Started
      link: /guide/getting-started
    - theme: alt
      text: API Reference
      link: /api/queryable

features:
  - icon: 🔒
    title: Fully type-safe
    details: Your IDE knows the shape of every row. Filter, select, and join with full autocomplete and compile-time checks.

  - icon: ⚡
    title: AOT compilation
    details: The optional TypeScript transformer compiles lambda expressions to ASTs at build time, eliminating all runtime parsing overhead.

  - icon: 🔌
    title: Driver-agnostic
    details: Works with PostgreSQL (node-postgres), SQLite (better-sqlite3), and MikroORM out of the box. Bring your own executor for anything else.

  - icon: 🪶
    title: Zero runtime magic
    details: Produces plain parameterised SQL. No ORM, no migrations, no hidden queries — just SQL you can read and reason about.
---
