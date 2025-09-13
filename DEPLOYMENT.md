# QuickRead Deployment Guide

This guide will help you deploy your QuickRead application using Render for the backend and Vercel for the frontend.

## 🎯 Overview

- **Backend**: FastAPI application deployed on Render (Free tier)
- **Frontend**: React application deployed on Vercel (Free tier)

## 📋 Prerequisites

Before deploying, ensure you have:
- GitHub account
- Render account (sign up at https://render.com)
- Vercel account (sign up at https://vercel.com)
- Your code pushed to a GitHub repository

## 🚀 Part 1: Deploy Backend to Render

### 1. Push Your Code to GitHub

```bash
# If not already done, initialize git and push to GitHub
cd /path/to/your/QuickRead
git add .
git commit -m "Prepare for deployment"
git push origin main
```

### 2. Deploy on Render

1. **Login to Render**: Go to https://render.com and login
2. **Create New Web Service**: Click "New +" → "Web Service"
3. **Connect Repository**: 
   - Connect your GitHub account
   - Select your QuickRead repository
4. **Configure Service**:
   - **Name**: `quickread-backend`
   - **Environment**: `Python 3`
   - **Region**: Choose closest to your users
   - **Branch**: `main`
   - **Root Directory**: `backend`
   - **Build Command**: `pip install -r requirements.txt`
   - **Start Command**: `uvicorn main:app --host 0.0.0.0 --port $PORT`
5. **Environment Variables**:
   - Add `PYTHON_VERSION` = `3.11.0`
   - Add `FRONTEND_URL` = `https://your-app-name.vercel.app` (you'll get this from Vercel)
6. **Create Web Service**: Click "Create Web Service"

### 3. Note Your Backend URL

After deployment, your backend will be available at:
`https://quickread-backend.onrender.com`

## 🌐 Part 2: Deploy Frontend to Vercel

### 1. Update Environment Variables

Update the `.env.production` file with your actual Render backend URL:

```bash
# .env.production
REACT_APP_BACKEND_URL=https://quickread-backend.onrender.com
```

### 2. Deploy on Vercel

#### Option A: Using Vercel CLI (Recommended)

```bash
# Install Vercel CLI
npm i -g vercel

# Navigate to frontend directory
cd frontend

# Deploy to Vercel
vercel

# Follow the prompts:
# - Set up and deploy? Yes
# - Which scope? (your account)
# - Link to existing project? No
# - Project name: quickread-frontend
# - In which directory is your code located? ./
```

#### Option B: Using Vercel Dashboard

1. **Login to Vercel**: Go to https://vercel.com and login
2. **Import Project**: Click "New Project"
3. **Import Git Repository**: 
   - Connect your GitHub account
   - Select your QuickRead repository
4. **Configure Project**:
   - **Framework Preset**: Create React App
   - **Root Directory**: `frontend`
   - **Build Command**: `npm run build`
   - **Output Directory**: `build`
   - **Install Command**: `npm install`
5. **Environment Variables**:
   - Add `REACT_APP_BACKEND_URL` = `https://quickread-backend.onrender.com`
6. **Deploy**: Click "Deploy"

### 3. Update CORS Configuration

After getting your Vercel URL, update the backend CORS settings:

1. Go to your Render dashboard
2. Open your backend service
3. Go to "Environment" tab
4. Update `FRONTEND_URL` to your Vercel URL (e.g., `https://quickread-frontend.vercel.app`)
5. Your service will automatically redeploy

## 🔄 Continuous Deployment

Both Render and Vercel will automatically redeploy when you push changes to your GitHub repository:

- **Backend**: Pushes to `main` branch will trigger Render redeployment
- **Frontend**: Pushes to `main` branch will trigger Vercel redeployment

## 🧪 Testing Your Deployment

1. **Test Backend**: Visit `https://your-backend-url.onrender.com/health`
   - Should return: `{"status": "ok"}`

2. **Test Frontend**: Visit your Vercel URL
   - Upload a PDF file
   - Verify it processes correctly

## 🔧 Common Issues & Solutions

### Backend Issues

**Issue**: Service won't start
- **Solution**: Check logs in Render dashboard. Ensure all dependencies in `requirements.txt`

**Issue**: CORS errors
- **Solution**: Verify `FRONTEND_URL` environment variable is set correctly

### Frontend Issues

**Issue**: "Failed to process PDF" error
- **Solution**: Check if `REACT_APP_BACKEND_URL` points to correct backend URL

**Issue**: Build fails
- **Solution**: Ensure all dependencies are in `package.json` and build locally first

## 📱 Custom Domains (Optional)

### For Vercel (Frontend)
1. Go to your project settings in Vercel
2. Navigate to "Domains" tab
3. Add your custom domain
4. Update DNS records as instructed

### For Render (Backend)
1. Upgrade to paid plan (required for custom domains)
2. Go to service settings
3. Add custom domain in "Custom Domains" section

## 💰 Cost Breakdown

### Free Tier Limits
- **Render**: 750 hours/month, sleeps after 15 min inactivity
- **Vercel**: 100GB bandwidth, 6000 builds/month

### Upgrade Considerations
- Render: $7/month for always-on service
- Vercel: $20/month for Pro features

## 🔒 Security Considerations

1. **Environment Variables**: Never commit sensitive data to Git
2. **CORS**: Keep CORS origins as restrictive as possible
3. **File Upload**: Consider adding file size limits and virus scanning
4. **Rate Limiting**: Add rate limiting for production use

## 📈 Monitoring

### Render
- View logs and metrics in dashboard
- Set up alerts for downtime

### Vercel
- Analytics available in dashboard
- Performance insights included

---

## Quick Deployment Checklist

- [ ] Code pushed to GitHub
- [ ] Backend deployed to Render
- [ ] Frontend deployed to Vercel
- [ ] Environment variables configured
- [ ] CORS settings updated
- [ ] Both services tested
- [ ] Custom domains configured (optional)

## Need Help?

- **Render Docs**: https://render.com/docs
- **Vercel Docs**: https://vercel.com/docs
- **FastAPI Deployment**: https://fastapi.tiangolo.com/deployment/
- **React Deployment**: https://create-react-app.dev/docs/deployment/