const express = require("express");
const app = express();
app.use(express.json());
const bcrypt = require("bcrypt");
const { open } = require("sqlite");
const sqlite3 = require("sqlite3");
const path = require("path");
const jwt = require("jsonwebtoken");
const format = require;
const dbPath = path.join(__dirname, "twitterClone.db");

let loggedUser = null;
let db = null;

const initiatedServer = async () => {
  try {
    db = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    });
    app.listen(3000);
    console.log("DB Assigned");
  } catch (error) {
    console.log(error.message);
    process.exit(1);
  }
};

initiatedServer();

//API 1 ** USER REGISTRATION

app.post("/register/", async (request, response) => {
  const { username, password, name, gender } = request.body;
  const existUserCheckQuery = `SELECT * FROM user WHERE username = '${username}';`;
  const dbUser = await db.get(existUserCheckQuery);
  if (dbUser !== undefined) {
    response.status(400);
    response.send("User already exists");
  } else {
    if (password.length < 6) {
      response.status(400);
      response.send("Password is too short");
    } else {
      const hashedPassword = await bcrypt.hash(password, 10);
      const userRegistrationQuery = `INSERT INTO user (username, password, name, gender)
            VALUES ('${username}', '${hashedPassword}', '${name}', '${gender}');`;
      await db.run(userRegistrationQuery);
      response.status(200);
      response.send("User created successfully");
    }
  }
});

//API 2 ** LOGIN

app.post("/login/", async (request, response) => {
  const { username, password } = request.body;
  const findUserQuery = `SELECT * FROM user WHERE username LIKE '${username}';`;
  const dbUser = await db.get(findUserQuery);
  if (dbUser === undefined) {
    response.status(400);
    response.send("Invalid user");
  } else {
    const isPasswordMatched = await bcrypt.compare(password, dbUser.password);
    if (isPasswordMatched) {
      const payload = {
        username: username,
      };
      const jwtToken = jwt.sign(payload, "codeword");
      response.send({ jwtToken });
    } else {
      response.status(400);
      response.send("Invalid password");
    }
  }
});

// Authentication with JWT Token

const authentication = async (request, response, next) => {
  let jwtToken = request.headers["authorization"];
  if (jwtToken !== undefined) {
    jwtToken = jwtToken.split(" ")[1];
  }
  jwt.verify(jwtToken, "codeword", async (error, payload) => {
    if (error) {
      response.status(401);
      response.send("Invalid JWT Token");
    } else {
      loggedUser = payload.username;
      next();
    }
  });
};

//API-3
const convertStateDbObjectToResponseObject = (dbObject) => {
  return {
    username: dbObject.username,
    tweet: dbObject.tweet,
    dateTime: dbObject.date_time,
  };
};
app.get("/user/tweets/feed/", authentication, async (request, response) => {
  const getLatestFeed = `select username,tweet,date_time from user inner join
    tweet on user.user_id=tweet.user_id
    order By date_time DESC
    limit 4;`;
  const latestArray = await db.all(getLatestFeed);
  response.send(
    latestArray.map((eachState) =>
      convertStateDbObjectToResponseObject(eachState)
    )
  );
});

//API-4
app.get("/user/following/", authentication, async (request, response) => {
  const getNames = `select user.username from user inner join follower 
    on 
    user.user_id=follower.following_user_id;`;
  const totalList = await db.all(getNames);
  response.send(totalList);
});

//API 5 ** FOLLOWERS LIST

app.get("/user/followers/", authentication, async (request, response) => {
  const usersWhoFollowedPeopleQuery = `
    SELECT DISTINCT name 
    FROM user 
    INNER JOIN follower 
    ON user.user_id = follower.follower_user_id
    `;
  const usersWhoFollowedPeople = await db.all(usersWhoFollowedPeopleQuery);
  response.send(usersWhoFollowedPeople);
});

//API 10 ** TWEET CREATION

app.post("/user/tweets/", authentication, async (request, response) => {
  const { tweet } = request.body;
  const tweetUserDetailQuery = `SELECT * FROM user WHERE username LIKE '${loggedUser}';`;
  const dbUser = await db.get(tweetUserDetailQuery);
  const currentDateTime = new Date();
  const formattedCurrentDateTime = `${currentDateTime.getFullYear()}-${
    currentDateTime.getMonth() + 1
  }-${currentDateTime.getDate()} ${currentDateTime.getHours()}:${currentDateTime.getMinutes()}:${currentDateTime.getSeconds()}`;
  const tweetPostingQuery = `INSERT INTO tweet (tweet, user_id, date_time)
    VALUES ( '${tweet}', ${dbUser.user_id}, '${formattedCurrentDateTime}');`;
  await db.run(tweetPostingQuery);

  response.send("Created a Tweet");
});

//API 11 ** TWEET DELETION

app.delete("/tweets/:tweetId/", authentication, async (request, response) => {
  const { tweetId } = request.params;
  const checkLoggedUserIdQuery = `SELECT * FROM user WHERE username = '${loggedUser}';`;
  const checkTweetUserIdQuery = `SELECT * FROM tweet WHERE tweet_id = ${tweetId};`;
  const dbTweet = await db.get(checkTweetUserIdQuery);
  const dbUser = await db.get(checkLoggedUserIdQuery);
  if (dbTweet !== undefined) {
    if (dbTweet.user_id === dbUser.user_id) {
      const tweetDeleteQuery = `DELETE FROM tweet WHERE user_id = ${dbUser.user_id} AND tweet_id = ${tweetId};`;
      await db.run(tweetDeleteQuery);
      response.send("Tweet Removed");
    } else {
      response.status(401);
      response.send("Invalid Request");
    }
  } else {
    response.status(401);
    response.send("Invalid Request");
  }
});

//API 6 **

app.get("/tweets/:tweetId/", authentication, async (request, response) => {
  try {
    const { tweetId } = request.params;
    const getLoggedUserDetailQuery = `SELECT * FROM user WHERE username = '${loggedUser}';`;
    const loggedUserDetail = await db.get(getLoggedUserDetailQuery);

    //----------------------

    const followerDetailWhoFollowUserQuery = `SELECT user.user_id FROM follower
    INNER JOIN user ON follower.follower_user_id = user.user_id
    WHERE following_user_id = ${loggedUserDetail.user_id};`;
    const test = await db.all(followerDetailWhoFollowUserQuery);

    //---------------------
    let followers = [];
    for (let follower of test) {
      followers.push(follower.user_id);
    }

    const tweetDetailsQuery = `SELECT tweet, COUNT(like_id) AS likes,
    COUNT(reply_id) AS replies, tweet.date_time AS dateTime
    FROM tweet INNER JOIN like ON like.tweet_id = tweet.tweet_id
    INNER JOIN reply ON reply.tweet_id = tweet.tweet_id
    WHERE tweet_id = ${tweetId} AND tweet.user_id IN (${test.user_id});`;

    //--------------------------
    const tweetDetails = await db.all(tweetDetailsQuery);
    response.send(tweetDetails);
  } catch (error) {
    console.log(error.message);
  }
});
module.exports = app;
