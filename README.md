  <h1 align="center">HogChat</h1>

![image](https://github.com/RhysSullivan/hogchat/assets/39114868/b0676b01-cf50-44df-a2df-8f669ce97eb3)



<p align="center">
  A way to talk with your PostHog data
</p>


## Running locally

Create a .env file with the following:
```env
OPENAI_API_KEY=""
POSTHOG_API_KEY=""
POSTHOG_PROJECT_ID=""
```

Then run
```bash
pnpm install
pnpm dev
```

## Known problems:

- GPT returns the wrong casing for HogQL functions i.e AVG( instead of avg(
- The context window can be too small

Your app should now be running on [localhost:3000](http://localhost:3000/).

## Authors

This app was created by [Rhys Sullivan](https://twitter.com/RhysSullivan). If you like it, be sure to checkout my other projects [Answer Overflow](https://www.answeroverflow.com) and [Typelytics](https://typelytics.rhyssul.com/)
