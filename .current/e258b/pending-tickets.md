# Pending tickets — lane e258b

```pending-ticket
lane_local_id: E258B-NEW-1
title: Extend the agc check comment-length scan beyond JS/TS (other // and /* */ languages, and # languages)
priority: P3
depends_on: [E258]
source: integrator pre-review of the e258b cut (2026-09-30)
body: |
  The E258 scan covers only .ts/.tsx/.js/.jsx/.mjs; adopter repos are not only JS.
  Candidates: Java, Kotlin, Swift, Go, Rust, C/C++, C# (// and /* */), and # languages
  (Python, shell, Ruby, YAML). Risk: per-language string-literal forms the lexer must not
  misread as comments — raw strings (Rust r#"..."#, C++ R"(...)", C# @"..." / """...""",
  Python triple quotes), Go backtick strings, Kotlin/Swift multi-line strings, and
  Python docstrings (comment or string?). Nested block comments (Rust, Swift, Kotlin).
```

## Applied
