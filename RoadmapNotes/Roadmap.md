# Roadmap of Features

- [x] Document Parsing
- [x] Document Conversion and Independent Rendering
- [x] Filesystem Management
- [x] Offline Support and Sync
- [x] Version Control and Management
- [x] Multi-format export
- [ ] Better editor with support for docx
- [x] Implementation of Language Servers
- [x] Document Hiearchy
- [ ] User Roles and Permission
- [ ] Project Management
- [ ] Real-Time Collaboration
- [ ] Templates

# Omitted

- [ ] Academic Structure Validation
- [ ] Format Compaitibility Analyzer

# Problems

- No documentation for Pandoc's WASM
- Conversion Conflicts, How to manage less feature-complete formats during merging - For Example, convert

```typ
// In Typst
#lorem(50)

// In Markdown
Lorem ipsum dolor sit amet ... (upto 50 words)

// Back in Typst
Lorem ipsum dolor sit amet ... (upto 50 words)
It deletes the function so we need a buffer maybe to keep track of changes like that.
```
