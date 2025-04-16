const socketIo = require("socket.io");
const db = require("../database");
const { DeliveryLocation } = require("../mongoose/schemas");
const jwt = require("jsonwebtoken");
const JWT_SECRET = process.env.JWT_SECRET ;
const cookieParser = require("cookie-parser");
const cookie = require("cookie");

const initializeSocket = (httpsServer) => {
  const io = socketIo(httpsServer);
  let activeUsers = {};
  let offlineMessages = {};

  function emitActiveUsers() {
    db.all("SELECT DISTINCT username FROM users", (err, rows) => {
      if (err) {
        console.log(err.message);
      } else {
        const activeUsersList = rows.map((row) => row.username);
        io.emit("active users", activeUsersList);
      }
    });
  }
  cookieParser();
  io.use((socket, next) => {
    // Manually parse cookies
    const cookies = cookie.parse(socket.request.headers.cookie || "");
    const token = cookies.token;

    // console.log("Parsed Cookies:", cookies);
    // console.log("Token:", token);

    if (token) {
      jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) {
          console.error("JWT Verification error:", err);
          return next(new Error("Authentication error"));
        }
        socket.user = user;
        next();
      });
    } else {
      next(new Error("Authentication error"));
    }
  });

  io.on("connection", (socket) => {
    console.log("A user connected:", socket.id);

    const username = socket.user.username;

    socket.on("set username", (username) => {
      // Use the username from the JWT payload directly
      db.run(
        "INSERT OR IGNORE INTO users (id, username) VALUES (?, ?)",
        [socket.id, username],
        (err) => {
          if (err) {
            return console.log(err.message);
          }
          activeUsers[username] = socket.id;
          console.log(`${username} (${socket.id}) set as active user`);

          // Handle offline messages (similar to the original code)
          if (offlineMessages[username]) {
            console.log("Sending offline messages to:", username);
            offlineMessages[username].forEach(
              ({ from, message, type, filename }) => {
                socket.emit("private message", {
                  from,
                  message,
                  type,
                  filename,
                });
              }
            );
            delete offlineMessages[username];
          }
          emitActiveUsers();
        }
      );
    });

    socket.on("disconnect", () => {
      db.run("DELETE FROM users WHERE id = ?", [socket.id], (err) => {
        if (err) {
          return console.log(err.message);
        }
        const username = Object.keys(activeUsers).find(
          (key) => activeUsers[key] === socket.id
        );
        if (username) {
          delete activeUsers[username];
          console.log(`${username} (${socket.id}) disconnected`);
        }
        emitActiveUsers();
      });
    });

    socket.on("private message", ({ to, message, type, filename }) => {
      const fromUser = Object.keys(activeUsers).find(
        (key) => activeUsers[key] === socket.id
      );
      if (fromUser) {
        db.run(
          "INSERT INTO messages (from_user, to_user, message, type, filename) VALUES (?, ?, ?, ?, ?)",
          [fromUser, to, message, type, filename],
          (err) => {
            if (err) {
              console.log(err.message);
            }
          }
        );

        const toSocketId = activeUsers[to];
        if (toSocketId) {
          io.to(toSocketId).emit("private message", {
            from: fromUser,
            message,
            type,
            filename,
          });
        } else {
          if (!offlineMessages[to]) {
            offlineMessages[to] = [];
          }
          offlineMessages[to].push({ from: fromUser, message, type, filename });
          console.log("Message queued for offline user:", to);
        }
        io.to(socket.id).emit("private message", {
          from: fromUser,
          message,
          type,
          filename,
        });
      } else {
        console.log("Error: Unable to send message. User not found.");
      }
    });

    socket.on("get messages", ({ from, to }) => {
      db.all(
        "SELECT * FROM messages WHERE (from_user = ? AND to_user = ?) OR (from_user = ? AND to_user = ?) ORDER BY received_at",
        [from, to, to, from],
        (err, rows) => {
          if (err) {
            console.log(err.message);
          } else {
            socket.emit("load messages", rows);
          }
        }
      );
    });

    // Handle location updates from clients
    socket.on("updateLocation", async (location) => {
      const { lat, lng, deliveryUsername, senderUsername } = location;
      console.log(
        `Location update received from ${senderUsername} (${socket.id}):`,
        location
      );

      try {
        // Ensure users are active
        if (!activeUsers[senderUsername]) {
          activeUsers[senderUsername] = socket.id;
        }

        // Find the delivery details matching the usernames
        const delivery = await DeliveryLocation.findOne({
          deliveryUsername: deliveryUsername,
          senderUsername: senderUsername,
        });

        if (delivery) {
          // Send the location update to the matched senderUsername
          io.to(socket.id).emit("updateLocation", {
            lat,
            lng,
            senderUsername,
          });
          console.log(
            `Location update sent to ${senderUsername} (${socket.id})`
          );

          // Send the location update to the matched deliveryUsername
          const toSocketId = activeUsers[deliveryUsername];
          if (toSocketId) {
            io.to(toSocketId).emit("updateLocation", {
              lat,
              lng,
              senderUsername,
            });
            console.log(
              `Location update sent to ${deliveryUsername} (${toSocketId})`
            );
          } else {
            // Store the offline message if the user is not online
            if (!offlineMessages[deliveryUsername]) {
              offlineMessages[deliveryUsername] = [];
            }
            offlineMessages[deliveryUsername].push({
              lat,
              lng,
              senderUsername,
            });
            console.log(
              "Location update queued for offline user:",
              deliveryUsername
            );
          }
        } else {
          console.log("No matching delivery found in the database");
        }
      } catch (error) {
        console.error(
          "Error fetching delivery details from the database:",
          error
        );
      }
    });
    socket.on("updateLocationrec", async (location) => {
      const { lat, lng, deliveryUsername, receiverName } = location;
      console.log(
        `Location update received from ${deliveryUsername} (${socket.id}):`,
        location
      );

      try {
        // Ensure users are active
        if (!activeUsers[receiverName]) {
          activeUsers[receiverName] = socket.id;
        }

        // Find the delivery details matching the usernames
        const delivery = await DeliveryLocation.findOne({
          deliveryUsername: deliveryUsername,
          receiverName: receiverName,
        });

        if (delivery) {
          // Send the location update to the matched senderUsername
          io.to(socket.id).emit("updateLocation", {
            lat,
            lng,
            receiverName,
          });
          console.log(`Location update sent to ${receiverName} (${socket.id})`);

          // Send the location update to the matched deliveryUsername
          const toSocketId = activeUsers[deliveryUsername];
          if (toSocketId) {
            io.to(toSocketId).emit("updateLocation", {
              lat,
              lng,
              deliveryUsername,
            });
            console.log(
              `Location update sent to ${deliveryUsername} (${toSocketId})`
            );
          } else {
            // Store the offline message if the user is not online
            if (!offlineMessages[deliveryUsername]) {
              offlineMessages[deliveryUsername] = [];
            }
            offlineMessages[deliveryUsername].push({
              lat,
              lng,
              receiverName,
            });
            console.log(
              "Location update queued for offline user:",
              deliveryUsername
            );
          }
        } else {
          console.log("No matching delivery found in the database");
        }
      } catch (error) {
        console.error(
          "Error fetching delivery details from the database:",
          error
        );
      }
    });
    socket.on("updateLocationrecd", async (location) => {
      const { lat, lng, deliveryUsername, receiverName } = location;
      console.log(
        `Location update received from ${receiverName} (${socket.id}):`,
        location
      );

      try {
        // Ensure users are active
        if (!activeUsers[receiverName]) {
          activeUsers[receiverName] = socket.id;
        }

        // Find the delivery details matching the usernames
        const delivery = await DeliveryLocation.findOne({
          deliveryUsername: deliveryUsername,
          receiverName: receiverName,
        });

        if (delivery) {
          // Send the location update to the matched senderUsername
          io.to(socket.id).emit("updateLocation", {
            lat,
            lng,
            receiverName,
          });
          console.log(`Location update sent to ${receiverName} (${socket.id})`);

          // Send the location update to the matched deliveryUsername
          const toSocketId = activeUsers[deliveryUsername];
          if (toSocketId) {
            io.to(toSocketId).emit("updateLocation", {
              lat,
              lng,
              deliveryUsername,
            });
            console.log(
              `Location update sent to ${deliveryUsername} (${toSocketId})`
            );
          } else {
            // Store the offline message if the user is not online
            if (!offlineMessages[deliveryUsername]) {
              offlineMessages[deliveryUsername] = [];
            }
            offlineMessages[deliveryUsername].push({
              lat,
              lng,
              receiverName,
            });
            console.log(
              "Location update queued for offline user:",
              deliveryUsername
            );
          }
        } else {
          console.log("No matching delivery found in the database");
        }
      } catch (error) {
        console.error(
          "Error fetching delivery details from the database:",
          error
        );
      }
    });
  });

  setInterval(() => {
    emitActiveUsers();
  }, 3000); // Emitting active users every 3 seconds
};

module.exports = initializeSocket;
