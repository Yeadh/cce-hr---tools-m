Cold Craft Tools + HR  (project: cold-craft-hr)
Deploy:  cd /d <এই folder>   ->   firebase deploy --only firestore:rules,hosting

Role অনুযায়ী অ্যাক্সেস
- admin     : সব (Tools + HR + Users)
- manager   : Damage charge, Export, Requests (edit/approve/reject) করতে পারবে;
              Summary, Add tool, Transfer, Condition, Projects, History শুধু দেখতে পারবে; Users/HR দেখবে না
- supervisor: শুধু নিজের assign করা project এর tools (Summary, Requests) + HR এর Manual Attendance ও Statement/Report
              (Assign করতে: Tools > Users > supervisor এর নিচে project টিক দিন)
- employee  : শুধু নিজের Portal (Email + Password 123456)
