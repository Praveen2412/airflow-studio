# Documentation Index

Welcome to the Airflow VSCode Extension documentation. This project has been redesigned following clean architecture principles and industry best practices.

## 📚 Documentation Overview

### For New Developers
Start here to understand the project:

1. **[README.md](README.md)** - User-facing documentation
   - What the extension does
   - How to install and use it
   - Quick start guide

2. **[QUICK_REFERENCE.md](QUICK_REFERENCE.md)** - Developer quick reference
   - Project structure at a glance
   - Where to add new code
   - Common patterns and examples
   - Quick lookup for daily development

3. **[ARCHITECTURE.md](ARCHITECTURE.md)** - Detailed architecture
   - Clean architecture principles
   - Layer responsibilities
   - Design patterns used
   - Best practices and anti-patterns

### For Understanding the Redesign
Learn about the transformation:

4. **[REDESIGN_SUMMARY.md](REDESIGN_SUMMARY.md)** - Before & After comparison
   - Visual structure comparison
   - Code examples (before vs after)
   - Benefits and improvements
   - Metrics and impact

5. **[MIGRATION.md](MIGRATION.md)** - Migration guide
   - What was done
   - Why it was done
   - How to complete the migration
   - Testing strategy

## 🎯 Quick Navigation

### I want to...

#### Understand the project structure
→ Read [QUICK_REFERENCE.md](QUICK_REFERENCE.md) - Section: "Project Structure at a Glance"

#### Add a new feature
→ Read [QUICK_REFERENCE.md](QUICK_REFERENCE.md) - Section: "Where to Add New Code"

#### Understand the architecture
→ Read [ARCHITECTURE.md](ARCHITECTURE.md) - Section: "Architecture Layers"

#### See code examples
→ Read [REDESIGN_SUMMARY.md](REDESIGN_SUMMARY.md) - Section: "Code Comparison"

#### Learn design patterns
→ Read [ARCHITECTURE.md](ARCHITECTURE.md) - Section: "Design Principles"

#### Write tests
→ Read [QUICK_REFERENCE.md](QUICK_REFERENCE.md) - Section: "Testing"

#### Complete the migration
→ Read [MIGRATION.md](MIGRATION.md) - Section: "Migration Steps"

## 📖 Reading Order

### For New Team Members
1. README.md (5 min) - Understand what the extension does
2. QUICK_REFERENCE.md (10 min) - Learn the structure and patterns
3. ARCHITECTURE.md (20 min) - Deep dive into architecture
4. REDESIGN_SUMMARY.md (15 min) - See the transformation

### For Existing Team Members
1. REDESIGN_SUMMARY.md (15 min) - See what changed
2. MIGRATION.md (10 min) - Understand next steps
3. QUICK_REFERENCE.md (10 min) - Learn new patterns
4. ARCHITECTURE.md (as needed) - Reference for details

### For Code Review
1. ARCHITECTURE.md - Section: "Best Practices"
2. QUICK_REFERENCE.md - Section: "Anti-Patterns to Avoid"

## 🏗️ Project Structure

```
Airflow-vscode-extension/
├── src/
│   ├── core/              # Business logic
│   ├── infrastructure/    # External dependencies
│   ├── presentation/      # UI layer
│   └── shared/           # Utilities
│
├── README.md             # User documentation
├── ARCHITECTURE.md       # Architecture details
├── QUICK_REFERENCE.md    # Developer quick guide
├── REDESIGN_SUMMARY.md   # Before/After comparison
├── MIGRATION.md          # Migration guide
└── DOCS_INDEX.md         # This file
```

## 🔑 Key Concepts

### Clean Architecture
- **Core**: Business logic, no external dependencies
- **Infrastructure**: External concerns (API, storage, logging)
- **Presentation**: UI layer (VSCode specific)
- **Shared**: Cross-cutting utilities

### Dependency Flow
```
Presentation → Core ← Infrastructure
     ↓           ↓
        Shared
```

### Design Principles
- **SOLID**: Single responsibility, Open/closed, Liskov substitution, Interface segregation, Dependency inversion
- **DRY**: Don't repeat yourself
- **KISS**: Keep it simple, stupid
- **YAGNI**: You aren't gonna need it

## 📝 Code Standards

### Naming Conventions
- **Classes**: PascalCase (e.g., `DagService`)
- **Interfaces**: PascalCase with `I` prefix (e.g., `IAirflowClient`)
- **Methods**: camelCase (e.g., `triggerDag`)
- **Constants**: UPPER_SNAKE_CASE (e.g., `MAX_RETRIES`)
- **Files**: PascalCase for classes (e.g., `DagService.ts`)

### File Organization
- One class per file
- File name matches class name
- Group related files in directories
- Keep files under 200 lines

### Import Order
1. External libraries (vscode, node modules)
2. Core layer imports
3. Infrastructure layer imports
4. Presentation layer imports
5. Shared layer imports
6. Relative imports

## 🧪 Testing

### Test Structure
```
tests/
├── unit/              # Unit tests
│   ├── core/         # Test services and models
│   └── shared/       # Test utilities
├── integration/       # Integration tests
│   └── infrastructure/ # Test API clients
└── e2e/              # End-to-end tests
```

### Test Naming
- Test files: `*.test.ts`
- Test suites: `describe('ClassName', () => {})`
- Test cases: `it('should do something', () => {})`

## 🚀 Getting Started

### Setup Development Environment
```bash
# Install dependencies
npm install

# Compile TypeScript
npm run compile

# Watch mode (auto-rebuild)
npm run watch

# Run tests
npm test

# Package extension
npm run package
```

### First Contribution
1. Read QUICK_REFERENCE.md
2. Find an issue or feature to work on
3. Follow the patterns in existing code
4. Write tests
5. Submit PR

## 📞 Support

### Questions About...

**Architecture decisions?**
→ See [ARCHITECTURE.md](ARCHITECTURE.md) - Section: "Design Principles"

**Where to put new code?**
→ See [QUICK_REFERENCE.md](QUICK_REFERENCE.md) - Section: "Where to Add New Code"

**How to test?**
→ See [QUICK_REFERENCE.md](QUICK_REFERENCE.md) - Section: "Testing"

**Migration status?**
→ See [MIGRATION.md](MIGRATION.md) - Section: "Checklist"

**Best practices?**
→ See [ARCHITECTURE.md](ARCHITECTURE.md) - Section: "Best Practices"

## 🔄 Keep Updated

This documentation should be updated when:
- Architecture changes
- New patterns are introduced
- Best practices evolve
- Migration progresses

## 📊 Documentation Status

| Document | Status | Last Updated |
|----------|--------|--------------|
| README.md | ✅ Complete | Current |
| ARCHITECTURE.md | ✅ Complete | Current |
| QUICK_REFERENCE.md | ✅ Complete | Current |
| REDESIGN_SUMMARY.md | ✅ Complete | Current |
| MIGRATION.md | ✅ Complete | Current |
| DOCS_INDEX.md | ✅ Complete | Current |

---

**Happy Coding! 🎉**

For questions or suggestions, please open an issue or contact the team.
