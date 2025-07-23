interface prospect {
    firstName: string,
    link: string
}

export const MAIL_SUBJECT = {
    PROSPECT_INVITATION: 'Prospect Invitation',
}

export const MAIL_MESSAGE ={
    PROSPECT_INVITATION: (prospect: prospect) => `
        <!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Welcome to Zoracom</title>
    <style>
        body {
            font-family: Arial, sans-serif;
            line-height: 1.6;
            color: #333333;
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
        }
        .header {
            text-align: left;
            margin-bottom: 30px;
        }
        .content {
            margin-bottom: 30px;
        }
        .button {
            display: inline-block;
            padding: 12px 24px;
            background-color: #0066cc;
            color: #ffffff;
            text-decoration: none;
            border-radius: 4px;
            font-weight: bold;
            margin: 20px 0;
        }
        .footer {
            font-size: 12px;
            color: #777777;
            text-align: center;
            margin-top: 40px;
            border-top: 1px solid #eeeeee;
            padding-top: 20px;
        }
        .signature {
            margin-top: 30px;
        }
    </style>
</head>
<body>
    <div class="header">
        <h1>Hi ${prospect.firstName},</h1>
        <h2>Welcome to Zoracom—You're Invited to Join Our Team!</h2>
    </div>
    
    <div class="content">
        <p>We're excited to welcome you to Zoracom</p>
        <p>Please find attached your offer documents, including your contract letter and NDA.</p>
        <p>To proceed, click the link below to accept or decline your offer.</p>
        
        <p><a href="${prospect.link}" class="button">View offer</a></p>
        
        <p>If you have any questions, feel free to reach out to HR at <a href="mailto:hrteam@zoracom.com">hrteam@zoracom.com</a>.</p>
    </div>
    
    <div class="signature">
        <p>Cheers,<br>The HR Team</p>
    </div>
    
    <div class="footer">
        <p>Copyright 2024 @ Zora Communications Limited All Rights Reserved.</p>
    </div>
</body>
</html>
    `,
}