# Contributing to DockBrain

Thank you for considering contributing to DockBrain! This document provides guidelines for contributing.

## Code of Conduct

- Be respectful and inclusive
- Focus on constructive feedback
- Help maintain a welcoming environment

## How to Contribute

### Reporting Bugs

1. Check if the bug is already reported in [Issues](https://github.com/TU_USUARIO/dockbrain/issues)
2. If not, create a new issue with:
   - Clear title
   - Steps to reproduce
   - Expected vs actual behavior
   - Environment (OS, Node.js version, etc.)
   - Logs (redact sensitive info)

### Suggesting Features

1. Check existing [Issues](https://github.com/TU_USUARIO/dockbrain/issues) and [Discussions](https://github.com/TU_USUARIO/dockbrain/discussions)
2. Create a new discussion with:
   - Clear use case
   - Expected behavior
   - Why it's valuable
   - Possible implementation approach

### Pull Requests

1. **Fork and clone:**
   ```bash
   git clone https://github.com/TU_USUARIO/dockbrain.git
   cd dockbrain
   ```

2. **Create a branch:**
   ```bash
   git checkout -b feature/your-feature-name
   ```

3. **Make changes:**
   - Follow existing code style
   - Add tests for new features
   - Update documentation

4. **Test:**
   ```bash
   npm test
   npm run lint
   npm run build
   ```

5. **Commit:**
   ```bash
   git commit -m "feat: add awesome feature"
   ```

   Follow [Conventional Commits](https://www.conventionalcommits.org/):
   - `feat:` new feature
   - `fix:` bug fix
   - `docs:` documentation
   - `refactor:` code refactoring
   - `test:` tests
   - `chore:` maintenance

6. **Push and create PR:**
   ```bash
   git push origin feature/your-feature-name
   ```

## Development Setup

```bash
# Install dependencies
npm install

# Run in dev mode (auto-reload)
npm run dev

# Run tests
npm test

# Run tests with coverage
npm run test:coverage

# Lint
npm run lint

# Format
npm run format
```

## Project Structure

```
src/
├── core/           # Core components
├── connectors/     # External integrations
├── persistence/    # Database layer
├── tools/          # Tool implementations
├── types/          # TypeScript types
└── utils/          # Utilities
```

## Adding a New Tool

1. Create tool class in `src/tools/your-tool/`:
   ```typescript
   export class YourTool extends BaseTool {
     getName() { return 'your_tool'; }
     getActions() { /* ... */ }
     protected async executeAction() { /* ... */ }
   }
   ```

2. Register in `src/tools/registry.ts`

3. Add tests in `tests/unit/tools/your-tool.test.ts`

4. Update documentation

5. Add config schema if needed

## Security

- **Never commit secrets** (.env, tokens, keys)
- **Sanitize inputs** in all tools
- **Validate permissions** before execution
- **Add audit logs** for sensitive operations
- **Review SECURITY.md** before contributing

## Testing

- Write tests for new features
- Maintain >80% code coverage
- Test security boundaries
- Test error handling

## Documentation

- Update README.md for user-facing changes
- Add JSDoc comments for complex functions
- Update SETUP_*.md for installation changes
- Document breaking changes

## Questions?

- Open a [Discussion](https://github.com/TU_USUARIO/dockbrain/discussions)
- Ask in [Issues](https://github.com/TU_USUARIO/dockbrain/issues)

Thank you for contributing! 🎉
