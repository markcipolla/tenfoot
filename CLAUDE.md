# CLAUDE.md - Project Instructions

## Mandatory Pre-Commit Checks

Before committing ANY code changes, you MUST run and pass these checks:

### 1. Rust Backend (src-tauri/)

```bash
# Run all tests
cd src-tauri && cargo test

# Run linting
cargo clippy -- -D warnings

# Check formatting
cargo fmt --check
```

### 2. Frontend (React/TypeScript)

```bash
# Run tests
npm test

# Run linting
npm run lint

# Type checking
npm run type-check
```

### 3. Full Pre-Commit Command

```bash
# Run everything from project root
npm run lint && npm run type-check && cd src-tauri && cargo fmt --check && cargo clippy -- -D warnings && cargo test
```

## Code Quality Requirements

- **100% test coverage** is required for all Rust code
- All tests must pass before committing
- No clippy warnings allowed (treated as errors with `-D warnings`)
- Code must be properly formatted with `cargo fmt` and `prettier`

## Cross-Platform Build

This project targets both macOS and Windows. When adding platform-specific code:

1. Use `#[cfg(target_os = "windows")]` and `#[cfg(target_os = "macos")]` attributes
2. Ensure both platforms have equivalent functionality
3. Test on both platforms when possible

## Store Integration Guidelines

Each store (Steam, Epic, GOG) must:

1. Implement the `GameStore` trait
2. Have comprehensive unit tests with mocked file system
3. Handle missing/unavailable stores gracefully
4. Support both installed game detection AND launching

## Running Coverage Reports

```bash
# Install cargo-llvm-cov for coverage
cargo install cargo-llvm-cov

# Generate coverage report
cd src-tauri && cargo llvm-cov --html
```
