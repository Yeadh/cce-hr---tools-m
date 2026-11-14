Cold Craft Tools + HR  (project: cold-craft-hr)
Deploy:  cd /d <এই folder>   ->   firebase deploy --only firestore:rules,hosting

Role অনুযায়ী অ্যাক্সেস
- admin     : সব (Tools + HR + Users)
- manager   : Damage charge, Export, Requests (edit/approve/reject) করতে পারবে;
              Summary, Add tool, Transfer, Condition, Projects, History শুধু দেখতে পারবে; Users/HR দেখবে না
- supervisor: শুধু নিজের assign করা project এর tools (Summary, Requests) + HR এর Manual Attendance ও Statement/Report
              (Assign করতে: Tools > Users > supervisor এর নিচে project টিক দিন)
- employee  : শুধু নিজের Portal (Email + Password 123456)

---- Update: Profile photo ----
Deploy: firebase deploy --only firestore:rules,hosting
- Employee dashboard header e camera button: নিজের profile photo upload/change (auto 256x256 resize, Firestore 'photos' collection)
- Admin/HR (employee ছাড়া সব role) যে কোনো employee এর photo দেখতে পারবে; Employee View তে photo দেখায় + "Photo" button দিয়ে admin ও বদলাতে পারে
