# Work Package System

A standardized system for managing complex development tasks through structured work packages that can be executed by AI agents.

## Quick Start

1. **Define the project** (if needed): Use `docs/command/define-workpkg.md` to align on goals and success criteria
2. **Create work packages**: Use `docs/command/create-workpkg.md` to break down the project into actionable tasks
3. **Execute work packages**: Agents follow the work package instructions
4. **Review completed work**: Use `docs/command/review-workpkg.md` to assess quality and completeness
5. **Clean up**: When user says "clean up", finalize documentation and remove workpkg files

## Command Files

All command files are located in `docs/command/`:

### Core Commands

- **`docs/command/define-workpkg.md`** - Align on project mission, goals, and success criteria before creating work packages
- **`docs/command/create-workpkg.md`** - Break down a project briefing into actionable work packages with proper naming and dependencies
- **`docs/command/review-workpkg.md`** - Review completed work packages for quality, completeness, and integration

### Specialized Reviews

- **`docs/command/review-architecture.md`** - Architecture-focused review that produces refactoring work packages
- **`docs/command/review-performance.md`** - Performance-focused review that produces optimization work packages

## Naming Convention

Work packages follow this naming pattern:

```
[project-name]-[number][parallel-suffix]-[task-name].md
```

**Examples**:
- `layout-system-01-flexbox-engine.md` - Sequential, must complete first
- `layout-system-02A-grid-system.md` - Parallel with 02B, depends on 01
- `layout-system-02B-header-body.md` - Parallel with 02A, depends on 01
- `layout-system-03-migration.md` - Depends on 01, 02A, 02B

**Rules**:
- Numbers indicate sequence: `01` before `02`, `02` before `03`
- Letter suffixes (A, B, C) indicate parallel workstreams
- **Parallel workstreams use the NEXT number after their prerequisite**: Workstreams depending on `01` are numbered `02A`, `02B` (not `01A`, `01B`)
- Parallel workstreams share the same base number and can run simultaneously
- All parallel workstreams with the same base number depend on the prerequisite completing first

## Folder Structure

### Single File Project
If a project is small enough for one work package:
```
docs/workpkg/
  └── project-name-01-task.md
```

### Multi-File Project
If a project needs multiple work packages:
```
docs/workpkg/
  └── project-name/
      ├── _OVERVIEW.md          # Project definition, work packages list, progress tracking
      ├── project-name-01-task.md
      ├── project-name-01A-task.md
      ├── project-name-01B-task.md
      └── project-name-02-task.md
```

## `_OVERVIEW.md` Structure

Every multi-file project has a `_OVERVIEW.md` file that contains:

1. **Project Definition** - Mission, goals, success criteria, constraints (from `docs/command/define-workpkg.md`)
2. **Work Packages List** - All work packages with status and dependencies
3. **Progress Tracking** - Completion percentage, quality scores, status table
4. **Notes** - Area for agents to add findings, blockers, decisions

## Work Package Template

Each work package file includes:

- **Agent Instructions** - Clear instructions at the top telling agents to start implementing immediately (DO NOT ask what to do - just start)
- **Overview** - What this work package accomplishes
- **Context** - How it fits into the overall project
- **Dependencies** - Prerequisites, what it provides, what it blocks
- **Current State** - What exists, what's missing
- **Implementation Tasks** - Detailed task breakdown
- **Technical Details** - Architecture, components, integration points
- **Acceptance Criteria** - Specific, testable criteria
- **Final Steps** - Critical steps including progress marker update
- **Notes** - Area for agent notes

**Important**: The "Agent Instructions" section at the top of each work package tells agents to start implementing immediately without asking for clarification. This ensures agents can begin work as soon as they receive the work package file.

## Workflow

### 1. Project Definition Phase
```
User provides briefing/context
    ↓
[docs/command/define-workpkg.md] → Align on goals, success criteria
    ↓
_OVERVIEW.md created with project definition
```

### 2. Work Package Creation Phase
```
Project definition/briefing
    ↓
[docs/command/create-workpkg.md] → Break down into work packages
    ↓
Work package files created
_OVERVIEW.md updated with work packages list
```

### 3. Execution Phase
```
Work packages assigned to agents
    ↓
Agents execute work packages
    ↓
Agents update progress in _OVERVIEW.md
    ↓
Work packages marked complete
```

### 4. Review Phase
```
Completed work packages
    ↓
[docs/command/review-workpkg.md] → Review quality, completeness
    ↓
Build errors fixed
Code quality assessed
Completion % calculated
    ↓
_OVERVIEW.md updated with review findings
    ↓
User informed: Ready for testing
```

### 5. Cleanup Phase
```
User says "clean up"
    ↓
Update README.md with user-facing info
Move important docs to permanent location
Delete all workpkg files
```

## Quality Standards

Work packages are evaluated on:

- **Code Quality (1-10)**: Architecture, type safety, error handling, performance, maintainability, documentation, reliability
- **Completeness (%)**: All tasks done, acceptance criteria met, integration complete
- **Integration**: Work packages work together, no conflicts

**Red Flags** (automatic quality deduction):
- Error suppression (-2 points)
- Type safety violations (-1 point)
- Performance issues (-1 to -2 points)
- Missing error handling (-1 point)
- Poor integration (-2 points)
- Incomplete implementation (-2 points)

## Best Practices

### When Creating Work Packages
- Be specific: Vague work packages lead to confusion
- Think about dependencies: Map them correctly
- Consider integration: Work packages should integrate cleanly
- Identify parallelization: Use letter suffixes for parallel work
- Include final steps: Progress markers are critical

### When Executing Work Packages
- **Start immediately** - The work package contains all instructions needed
- **Do NOT ask "what should I do?"** - Read the Agent Instructions section and begin implementation
- Follow instructions precisely
- Update progress markers
- Document findings in notes
- Don't skip final steps
- Communicate blockers in _OVERVIEW.md

### When Reviewing
- Be thorough: Don't skip steps
- Fix, don't just document: Fix issues if straightforward
- Be honest about quality: Accurate assessment maintains standards
- Think about the whole: Consider integration
- Provide clear testing instructions

## Specialized Reviews

### Architecture Review
Use `docs/command/review-architecture.md` to:
- Identify architectural issues and technical debt
- Create refactoring work packages
- Improve code organization and patterns
- Address scalability and maintainability

### Performance Review
Use `docs/command/review-performance.md` to:
- Identify performance bottlenecks
- Create optimization work packages
- Improve rendering and algorithm performance
- Address memory and resource issues

## Tips

- **Start with definition**: For complex projects, use `docs/command/define-workpkg.md` first
- **Don't over-parallelize**: Too many parallel streams cause integration issues
- **Update progress**: Agents must update `_OVERVIEW.md` when completing work
- **Review regularly**: Don't wait until everything is done
- **Measure improvements**: For performance work, measure before/after
- **Document decisions**: Important architectural decisions should be preserved

## Example Projects

See existing work packages in this folder for examples:
- `LAYOUT_SYSTEM_REDESIGN.md` - Example briefing document
- `LAYOUT_WORKSTREAMS_OVERVIEW.md` - Example `_OVERVIEW.md` structure
- `LAYOUT_WORKSTREAM_*.md` - Example work package files
