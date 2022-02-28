db.createUser(
    {
        user: "user1",
        pwd: "useruser",
        roles : [
            {
                role: 'readWrite',
                db: 'htcard-mongo'
            }
        ]
    }
)
