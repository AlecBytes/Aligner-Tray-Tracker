# AGENTS.md

# Expo HAS CHANGED

Read the exact versioned docs at https://docs.expo.dev/versions/v57.0.0/ before writing any code.

https://docs.expo.dev/versions/latest/sdk/ui/swift-ui/

## Project

Aligner Tracker is a performance-first, utility-first aligner tracking app.

Architecture and product requirements are documented in:

- docs/mvp-plan.md

## Core principles

- Performance and utility are the primary product goals.
- Privacy and user-centric policy are secondary goals.
- Mobile functionality is local-first.
- SQLite is the source of truth on the device.
- Normal tracker actions must not require network access.
- Prefer simple implementations and minimal dependencies.
- Do not add features that are outside the current task.

## Stack

Frontend:
- React Native
- Expo
- TypeScript
- Expo Router
- SQLite

Backend:
- ASP.NET Core
- .NET 10
- EF Core
- SQL Server / Azure SQL

## Working style

Before implementing a feature, read only the relevant portion of
docs/mvp-plan.md.

Do not implement future roadmap features unless explicitly requested.

## UI and Layout Conventions

- Screen scrolling must be intentional.
- Compact core-action screens should fit within the usable viewport and should not scroll.
- Forms and content-heavy screens may scroll when needed, especially for keyboard accessibility.
- Multi-field forms should keep the focused input visible and provide natural Next/Done navigation where appropriate.
- Respect safe areas and prefer built-in React Native/Expo layout and keyboard APIs before adding dependencies.