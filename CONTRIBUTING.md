# Contributing to FLOWFADE

Thank you for your interest in contributing! This document outlines the development workflow, coding standards, and guidelines for contributing to FLOWFADE.

---

## 🚀 Development Setup

### Prerequisites
- Node.js 18+ (LTS recommended)
- npm 9+
- Modern browser (Chrome 90+, Firefox 88+, Safari 15+, Edge 90+)

### Installation
```bash
# Clone the repository
git clone <repository-url>
cd FLOWFADE

# Install dependencies
npm install

# Start development server
npm run dev
```

### Available Scripts
```bash
npm run dev          # Start Vite dev server (HMR enabled)
npm run build        # Production build (outputs to dist/)
npm run preview      # Preview production build locally
npm run lint         # Run ESLint (must pass before PR)
npm run test         # Run Vitest tests
npm run test:coverage # Run tests with coverage report
```

---

## 📝 Code Style & Standards

### ESLint Configuration
- **Config**: `.eslintrc.cjs`
- **Extends**: `eslint:recommended`, `plugin:react/recommended`, `plugin:react-hooks/recommended`, `plugin:react-refresh/recommended`
- **Parser**: ES modules (`sourceType: module`)
- **Disabled rules**: `react/prop-types`, `react/react-in-jsx-scope` (using JSX transform)

### Formatting Conventions
- **Indentation**: 2 spaces (no tabs)
- **Quotes**: Single quotes for strings
- **Semicolons**: Required
- **Trailing commas**: ES5 style (objects, arrays)
- **Line length**: 100 characters soft limit

### React Patterns
```jsx
// ✅ Functional components with hooks
function MyComponent({ initialValue }) {
  const [state, setState] = useState(initialValue)
  return <div>{state}</div>
}

// ✅ Custom hooks for shared logic
function useCustomHook() { ... }

// ✅ JSDoc for component props
/**
 * @typedef {Object} MyComponentProps
 * @property {string} title
 * @property {() => void} onClick
 */
function MyComponent({ title, onClick }) { ... }

// ❌ Class components (unless necessary for lifecycle)
// ❌ Inline styles (use Tailwind classes)
// ❌ PropTypes (use JSDoc typedefs instead)
```

### File Naming
- **Components**: `PascalCase.jsx` (e.g., `Player.jsx`, `WaveBackground.jsx`)
- **Hooks**: `camelCase.js` with `use` prefix (e.g., `useAudioAnalyser.js`)
- **Services**: `PascalCase.js` (e.g., `AudioEngine.js`, `DJEngine.js`)
- **Utilities**: `camelCase.js` (e.g., `formatTime.js`)
- **Tests**: `{name}.test.js` alongside source file

---

## 🏗️ Architecture Guidelines

### Service Layer
Services are **singletons** exported as named exports:
```javascript
// src/services/AudioEngine.js
export const audioEngine = new AudioEngine()

// Usage
import { audioEngine } from '../services/AudioEngine'
```

### State Management
- **Global state**: React Context (`PlaybackContext`)
- **Local state**: `useState` / `useReducer` in components
- **Derived state**: Custom hooks (`usePlaybackHelpers`)
- **Persistent state**: IndexedDB via Dexie (`AudioStorageService`)

### Adding New Features
1. **Service first**: Core logic in `src/services/`
2. **Hook second**: React integration in `src/hooks/`
3. **Component last**: UI in `src/components/`
4. **Tests**: Add `.test.js` file alongside

### Web Audio Best Practices
- Reuse `AudioContext` (single instance)
- Pool `HTMLAudioElement` (2 slots for crossfade)
- Clean up `ObjectURL`s with `URL.revokeObjectURL()`
- Cancel animation frames on unmount
- Handle `AudioContext` suspension (auto-resume on interaction)

---

## 🧪 Testing

### Test Stack
- **Vitest 2** — Test runner
- **React Testing Library** — Component testing
- **jsdom** — DOM environment
- **@vitest/coverage-v8** — Coverage

### Writing Tests
```javascript
// src/services/MyService.test.js
import { describe, test, expect, vi, beforeEach } from 'vitest'
import { myService } from './MyService'

describe('MyService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Reset service state
  })

  test('does something', () => {
    const result = myService.doSomething()
    expect(result).toBe(expected)
  })
})
```

### Mocking Strategy
- **Global mocks**: `src/test/setup.js` (AudioContext, Audio, MediaSession, etc.)
- **Module mocks**: `vi.mock('../path')` in test files
- **Timers**: `vi.useFakeTimers()` / `vi.advanceTimersByTime()`

### Coverage Requirements
- **New code**: ≥80% statements, ≥70% branches
- **Critical paths** (AudioEngine, DJEngine): ≥90% statements
- Run `npm run test:coverage` to verify

---

## 🔧 Git Workflow

### Branch Naming
```
feature/short-description    # New feature
fix/short-description        # Bug fix
refactor/short-description   # Code improvement
docs/short-description       # Documentation
test/short-description       # Test additions
```

### Commit Messages
Follow [Conventional Commits](https://www.conventionalcommits.org/):
```
type(scope): description

[optional body]

[optional footer]
```

Types: `feat`, `fix`, `refactor`, `docs`, `test`, `chore`, `perf`

Examples:
```
feat(audio): add beat-sync playback rate adjustment
fix(ui): resolve waveform rendering on iOS
refactor(store): extract playback helpers to custom hook
docs: add API reference for DJEngine
test(services): add AudioEngine crossfade tests
```

### Pull Request Process
1. **Create branch** from `main`
2. **Make changes** with tests
3. **Run checks**: `npm run lint && npm run test`
4. **Open PR** with description
5. **CI passes** (lint, test, build)
6. **Review** (1 approval minimum)
7. **Squash merge** to `main`

---

## 🐛 Bug Reports

### Before Reporting
- Check existing issues
- Test on latest `main` branch
- Try to reproduce in incognito/clean profile

### Bug Report Template
```markdown
**Description**: Clear summary of the bug

**Steps to Reproduce**:
1. Go to...
2. Click...
3. Observe...

**Expected Behavior**: What should happen

**Actual Behavior**: What happens

**Environment**:
- Browser: [e.g., Chrome 120]
- OS: [e.g., macOS 14]
- Device: [Desktop / iPhone 15 / etc.]

**Logs/Screenshots**: If applicable
```

---

## ✨ Feature Requests

### Feature Request Template
```markdown
**Problem**: What problem does this solve?

**Proposed Solution**: How should it work?

**Alternatives Considered**: Other approaches

**Additional Context**: Mockups, references, etc.
```

---

## 📦 Release Process

### Versioning
[Semantic Versioning](https://semver.org/): `MAJOR.MINOR.PATCH`

### Release Checklist
- [ ] All tests pass
- [ ] Lint passes
- [ ] Build succeeds
- [ ] CHANGELOG updated
- [ ] Version bumped in `package.json`
- [ ] Tag created: `vX.Y.Z`
- [ ] Deploy to staging
- [ ] Smoke test staging
- [ ] Deploy to production

---

## 📄 License

By contributing, you agree that your contributions will be licensed under the MIT License.

---

## 🙋 Getting Help

- **Discussions**: GitHub Discussions for questions
- **Issues**: GitHub Issues for bugs/features
- **Discord**: [Community server link if available]

---

## 🏷️ Labels Reference

| Label | Purpose |
|-------|---------|
| `bug` | Something isn't working |
| `enhancement` | New feature or improvement |
| `documentation` | Documentation changes |
| `good first issue` | Beginner-friendly |
| `help wanted` | Community contribution welcome |
| `priority: high` | Urgent/blocking |
| `priority: low` | Nice to have |
| `status: blocked` | Waiting on external dependency |
| `status: in progress` | Currently being worked on |
| `status: review needed` | Ready for review |

---

Thank you for contributing to FLOWFADE! 🎵