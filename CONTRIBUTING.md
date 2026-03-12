# Contributing to Digital Utopia

Thanks for your interest in contributing! Here's how to get started.

## Development Setup

```bash
git clone https://github.com/tishi-tech/digital-utopia.git
cd digital-utopia
npm install
npm run dev
```

See [INSTALL.md](./INSTALL.md) for detailed setup instructions.

## Ways to Contribute

### 1. Bug Reports

Open a [GitHub Issue](https://github.com/tishi-tech/digital-utopia/issues) with:
- Steps to reproduce
- Expected vs actual behavior
- Node.js version, OS, and Claude CLI version

### 2. Feature Requests

Open an issue with the `enhancement` label. Describe:
- The use case you're trying to solve
- How it should work
- Any alternatives you've considered

### 3. Code Contributions

1. Fork the repo
2. Create a feature branch: `git checkout -b feat/my-feature`
3. Make your changes with tests
4. Submit a Pull Request

#### Code Style

- TypeScript for engine code
- React + TypeScript for frontend
- Run `npm run lint` before submitting

### 4. Documentation

Improvements to README, guides, or inline docs are always welcome.

### 5. Agent Templates

Share agent roles, skills, or economy configurations in `templates/`.

## Project Structure

```
engine/       TypeScript runtime (API + world loop)
frontend-new/ React dashboard
shared/       Shared types
templates/    Agent role templates
docs/         Documentation
```

## Questions?

- [GitHub Discussions](https://github.com/tishi-tech/digital-utopia/discussions)
- Email: support@tishi.tech
