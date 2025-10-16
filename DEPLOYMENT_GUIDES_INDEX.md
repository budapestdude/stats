# Deployment Guides Index

This project has accumulated multiple deployment guides during development. This index helps you find the right guide for your needs.

## 📋 Quick Reference

### For Production Deployment
→ **Start here**: `RAILWAY_DEPLOYMENT_STATUS.md` - Current production status and detailed deployment info

### For Docker Deployment
→ **Use**: `docker-compose.yml` with the included `Dockerfile`

### For Local Development
→ **Read**: `CLAUDE.md` - Complete development guide with all commands

---

## 📚 Available Deployment Guides

### Railway Deployment (Current Production)
1. **RAILWAY_DEPLOYMENT_STATUS.md** ⭐ **PRIMARY**
   - Current deployment status
   - What's working, what's not
   - Database download system
   - Performance metrics
   - Recent fixes and updates
   - **Use this** for understanding the current state

2. **RAILWAY_DEPLOYMENT_V3_GUIDE.md**
   - Step-by-step Railway deployment
   - Database upload strategy
   - Environment variables
   - **Historical reference** for V3 deployment process

3. **RAILWAY_DEPLOYMENT_GUIDE.md**
   - Earlier version deployment guide
   - **May be outdated** - prefer V3 guide or status doc

4. **RAILWAY_DEPLOYMENT_SUCCESS.md**
   - Deployment success log
   - Historical record of initial deployment
   - **Archive/reference only**

5. **RAILWAY_DEPLOYMENT_CHECKLIST.md**
   - Pre-deployment checklist
   - Useful for **validating before deployment**

### Hetzner VPS Deployment
6. **HETZNER_SETUP_GUIDE.md** ⭐ **PRIMARY FOR HETZNER**
   - Complete Hetzner VPS setup
   - SSH configuration
   - Docker deployment on VPS
   - **Use this** for Hetzner deployment

7. **HETZNER_SIMPLIFIED_SETUP.md**
   - Streamlined Hetzner setup
   - Simpler than full guide
   - **Alternative to above** for quick setup

### General Deployment
8. **DEPLOYMENT-GUIDE.md**
   - General deployment concepts
   - **May overlap** with Railway guides

9. **DEPLOYMENT.md**
   - High-level deployment overview
   - **May be outdated** or duplicative

### GitHub Auto-Deploy
10. **GITHUB_AUTO_DEPLOY.md**
    - GitHub Actions CI/CD setup
    - Automated deployment configuration
    - **For future implementation**

### Hosting Options
11. **HOSTING_GUIDE.md**
    - Comparison of hosting options
    - Pros/cons of different platforms
    - **Reference for choosing hosting**

12. **BUDGET_HOSTING_GUIDE.md**
    - Low-cost hosting options
    - Budget-friendly alternatives
    - **For cost-conscious deployment**

---

## 🎯 Which Guide Should I Use?

### Scenario 1: "I want to understand the current production deployment"
→ **Read**: `RAILWAY_DEPLOYMENT_STATUS.md`

### Scenario 2: "I want to deploy to Railway myself"
→ **Follow**: `RAILWAY_DEPLOYMENT_V3_GUIDE.md`
→ **Then check**: `RAILWAY_DEPLOYMENT_CHECKLIST.md`

### Scenario 3: "I want to deploy to a Hetzner VPS"
→ **Follow**: `HETZNER_SETUP_GUIDE.md` or `HETZNER_SIMPLIFIED_SETUP.md`

### Scenario 4: "I want to deploy using Docker locally or on any VPS"
→ **Use**: `docker-compose.yml` + `Dockerfile`
→ **Commands**:
```bash
# Production (recommended pooled server only)
docker-compose --profile production up -d

# Development (all servers)
docker-compose --profile dev up -d
```

### Scenario 5: "I'm evaluating hosting options"
→ **Compare**: `HOSTING_GUIDE.md` and `BUDGET_HOSTING_GUIDE.md`

### Scenario 6: "I want CI/CD automation"
→ **Implement**: `GITHUB_AUTO_DEPLOY.md`

### Scenario 7: "I just want to develop locally"
→ **Read**: `CLAUDE.md` section on Development Commands

---

## 🧹 Consolidation Recommendations

### Keep (Essential)
- ✅ `RAILWAY_DEPLOYMENT_STATUS.md` - Living document, keep updated
- ✅ `HETZNER_SETUP_GUIDE.md` - Distinct deployment target
- ✅ `docker-compose.yml` + `Dockerfile` - Docker deployment
- ✅ `CLAUDE.md` - Primary development guide

### Consolidate (Similar Content)
- 🔄 Merge `RAILWAY_DEPLOYMENT_GUIDE.md` + `RAILWAY_DEPLOYMENT_V3_GUIDE.md`
  - Keep V3 as the primary, archive older versions
- 🔄 Merge `DEPLOYMENT.md` + `DEPLOYMENT-GUIDE.md`
  - Consolidate into single general deployment guide

### Archive (Historical/Reference)
- 📦 `RAILWAY_DEPLOYMENT_SUCCESS.md` → Move to `docs/archive/`
- 📦 Older Railway guides → Move to `docs/archive/railway/`

### Evaluate (May be obsolete)
- ❓ `HETZNER_SIMPLIFIED_SETUP.md` - Keep if significantly different, else merge
- ❓ `BUDGET_HOSTING_GUIDE.md` - Keep if still relevant

---

## 📁 Proposed Directory Structure

```
docs/
├── deployment/
│   ├── RAILWAY.md              # Consolidated Railway guide
│   ├── HETZNER.md              # Hetzner deployment
│   ├── DOCKER.md               # Docker deployment guide
│   └── HOSTING_OPTIONS.md      # Hosting comparison
├── archive/
│   ├── railway/
│   │   ├── v1-deployment.md
│   │   ├── v2-deployment.md
│   │   └── deployment-success-log.md
│   └── old-deployment-guides/
└── ci-cd/
    └── GITHUB_ACTIONS.md       # CI/CD setup

# Keep in root
RAILWAY_DEPLOYMENT_STATUS.md    # Current production status
CLAUDE.md                        # Primary dev guide
README.md                        # Project overview
```

---

## 🔄 Update Process

When deployment configuration changes:
1. **Update** `RAILWAY_DEPLOYMENT_STATUS.md` first
2. **Update** relevant guides (Railway/Hetzner/Docker)
3. **Update** this index if guides are added/removed
4. **Test** the deployment following the updated guide
5. **Archive** outdated information

---

## 📞 Quick Help

- **Production issue?** → Check `RAILWAY_DEPLOYMENT_STATUS.md` Known Issues section
- **Can't find a guide?** → Check this index or `CLAUDE.md`
- **Guide seems wrong?** → Check the "Last Updated" date, may be obsolete

---

**Last Updated**: October 2025
**Maintained by**: Project Team
**Update Frequency**: As deployment configuration changes
