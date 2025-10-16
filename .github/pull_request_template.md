# Pull Request

## Description
<!-- Provide a clear and concise description of your changes -->


## Type of Change
<!-- Mark the relevant option with an 'x' -->
- [ ] Bug fix (non-breaking change which fixes an issue)
- [ ] New feature (non-breaking change which adds functionality)
- [ ] Breaking change (fix or feature that would cause existing functionality to not work as expected)
- [ ] Documentation update
- [ ] Code refactoring (no functional changes)
- [ ] Performance improvement
- [ ] Test coverage improvement

## Related Issues
<!-- Link related issues here using #issue_number -->
Closes #
Relates to #

## Changes Made
<!-- List the main changes in this PR -->
-
-
-

## Testing
<!-- Describe the testing you've done -->

### Test Coverage
- [ ] Unit tests added/updated
- [ ] Integration tests added/updated
- [ ] All tests passing (`npm test`)
- [ ] Test coverage maintained/improved

### Manual Testing
<!-- Describe manual testing performed -->
- [ ] Tested locally on port 3010 (pooled server)
- [ ] Tested frontend changes on http://localhost:3000
- [ ] Tested API endpoints with test page
- [ ] Tested on different browsers (if frontend change)

## Screenshots/Videos
<!-- If applicable, add screenshots or videos demonstrating the changes -->


## Database Changes
<!-- If this PR includes database changes, describe them here -->
- [ ] No database changes
- [ ] Schema changes (describe below)
- [ ] New indexes (describe below)
- [ ] Migration script included

Database changes:
```sql
-- Paste SQL changes here if applicable
```

## Configuration Changes
<!-- Check if any configuration changes are needed -->
- [ ] No configuration changes
- [ ] Environment variables added/modified (document in .env.example)
- [ ] npm scripts added/modified
- [ ] Docker configuration updated

## Documentation
<!-- Ensure documentation is up to date -->
- [ ] Code is self-documenting with clear variable names
- [ ] Complex logic is commented
- [ ] JSDoc comments added for new functions
- [ ] README.md updated (if needed)
- [ ] CLAUDE.md updated (if needed)
- [ ] API documentation updated (if new endpoints)

## Code Quality Checklist
<!-- All items must be checked before merging -->
- [ ] Code follows project style guidelines
- [ ] ESLint passes (`npm run lint`)
- [ ] Prettier formatting applied (`npm run format`)
- [ ] TypeScript compiles without errors (`npm run build:backend`)
- [ ] No console.log statements (using logger instead)
- [ ] No commented-out code (unless absolutely necessary with explanation)
- [ ] Error handling implemented
- [ ] Loading states added (for frontend changes)
- [ ] Accessibility considered (for frontend changes)

## Performance Impact
<!-- Consider performance implications -->
- [ ] No performance impact
- [ ] Performance improved (describe below)
- [ ] Performance may be affected (describe below and justify)

Performance notes:


## Breaking Changes
<!-- If this introduces breaking changes, describe them and the migration path -->
- [ ] No breaking changes
- [ ] Breaking changes (describe below)

Breaking changes and migration:


## Deployment Notes
<!-- Any special considerations for deployment -->
- [ ] No special deployment steps needed
- [ ] Requires database migration
- [ ] Requires environment variable updates
- [ ] Requires new npm dependencies (`npm install`)
- [ ] Other deployment notes (describe below)

Deployment notes:


## Reviewer Checklist
<!-- For reviewers - do not edit -->
- [ ] Code reviewed for quality and maintainability
- [ ] Tests reviewed and sufficient
- [ ] Documentation reviewed and sufficient
- [ ] Security considerations reviewed
- [ ] Performance implications considered
- [ ] No obvious bugs or issues

## Post-Merge Tasks
<!-- Tasks to be done after merging, if any -->
- [ ] None
- [ ] Update production documentation
- [ ] Notify team of breaking changes
- [ ] Deploy to staging for testing
- [ ] Other (specify):

---

## Additional Notes
<!-- Any additional information reviewers should know -->


---

**I confirm that:**
- [ ] I have read the [CONTRIBUTING.md](../CONTRIBUTING.md) guidelines
- [ ] My code follows the project's coding standards
- [ ] I have performed a self-review of my own code
- [ ] I have tested my changes thoroughly
- [ ] I have commented my code where necessary
- [ ] My changes generate no new warnings
- [ ] I have updated the documentation accordingly
