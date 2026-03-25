# Branch Protection Configuration

This document describes the required branch protection rules for the CodeLink project to ensure code quality and prevent regressions.

## Required Branch Protection Rules for `main`

### Status Checks
- **Require status checks to pass before merging**: ✓ Enabled
- **Required status checks**:
  - `Run Tests` (from test.yml workflow)
  - `Branch Protection Requirements` (from test.yml workflow)
- **Require branches to be up to date before merging**: ✓ Enabled

### Coverage Requirements
The CI/CD pipeline enforces the following coverage thresholds:
- **Lines**: 80% minimum
- **Functions**: 80% minimum
- **Branches**: 80% minimum
- **Statements**: 80% minimum

**Property 15: Coverage Threshold Enforcement**
- The test workflow will fail if coverage falls below 80% for any category
- This validates Requirements 1.4, 20.6, and 20.10

### Pull Request Requirements
- **Require pull request reviews before merging**: Recommended (at least 1 approval)
- **Dismiss stale pull request approvals when new commits are pushed**: Recommended
- **Require review from Code Owners**: Optional (if CODEOWNERS file exists)

### Additional Protections
- **Require linear history**: Optional (prevents merge commits)
- **Include administrators**: Recommended (apply rules to admins too)
- **Allow force pushes**: ✗ Disabled
- **Allow deletions**: ✗ Disabled

## How to Configure

### Via GitHub Web UI

1. Navigate to your repository on GitHub
2. Go to **Settings** > **Branches**
3. Click **Add rule** or edit existing rule for `main`
4. Configure the following settings:

   **Branch name pattern**: `main`
   
   **Protect matching branches**:
   - ✓ Require a pull request before merging
     - Required approvals: 1
     - ✓ Dismiss stale pull request approvals when new commits are pushed
   
   - ✓ Require status checks to pass before merging
     - ✓ Require branches to be up to date before merging
     - **Required status checks**:
       - `Run Tests`
       - `Branch Protection Requirements`
   
   - ✓ Require conversation resolution before merging
   
   - ✓ Include administrators (recommended)
   
   - ✗ Allow force pushes (disabled)
   
   - ✗ Allow deletions (disabled)

5. Click **Create** or **Save changes**

### Via GitHub CLI

```bash
# Install GitHub CLI if not already installed
# https://cli.github.com/

# Configure branch protection
gh api repos/:owner/:repo/branches/main/protection \
  --method PUT \
  --field required_status_checks='{"strict":true,"contexts":["Run Tests","Branch Protection Requirements"]}' \
  --field enforce_admins=true \
  --field required_pull_request_reviews='{"required_approving_review_count":1,"dismiss_stale_reviews":true}' \
  --field restrictions=null \
  --field allow_force_pushes=false \
  --field allow_deletions=false
```

### Via Terraform (Infrastructure as Code)

```hcl
resource "github_branch_protection" "main" {
  repository_id = github_repository.repo.node_id
  pattern       = "main"

  required_status_checks {
    strict   = true
    contexts = ["Run Tests", "Branch Protection Requirements"]
  }

  required_pull_request_reviews {
    required_approving_review_count = 1
    dismiss_stale_reviews          = true
  }

  enforce_admins = true

  allows_force_pushes = false
  allows_deletions    = false
}
```

## Verification

After configuring branch protection, verify the setup:

1. **Check status checks are required**:
   - Try to merge a PR without passing tests (should be blocked)
   - Verify "Run Tests" check appears in PR status

2. **Check coverage enforcement**:
   - Create a PR that reduces coverage below 80%
   - Verify the test workflow fails with coverage error

3. **Check branch protection is active**:
   - Try to push directly to `main` (should be blocked)
   - Try to force push to `main` (should be blocked)

## Troubleshooting

### Status check not appearing
- Ensure the workflow has run at least once on the `main` branch
- Check that the job name in the workflow matches the required status check name
- Wait a few minutes for GitHub to register the status check

### Coverage threshold not enforced
- Verify vitest coverage configuration includes threshold settings
- Check that `test:coverage` script is configured correctly in package.json
- Review workflow logs to ensure coverage report is generated

### Unable to merge despite passing tests
- Ensure branch is up to date with `main`
- Check that all required status checks have completed
- Verify no unresolved conversations exist on the PR

## Related Documentation

- [GitHub Branch Protection Documentation](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches/about-protected-branches)
- [GitHub Actions Status Checks](https://docs.github.com/en/pull-requests/collaborating-with-pull-requests/collaborating-on-repositories-with-code-quality-features/about-status-checks)
- [Codecov Documentation](https://docs.codecov.com/docs)
