interface prospect {
    firstName: string,
    link: string
}
interface response {
    firstName: string,
    lastName: string,
}

interface updateUser{
    comment: string,
    firstName: string,
    link: string
}

export const MAIL_SUBJECT = {
    PROSPECT_INVITATION: 'Prospect Invitation',
    OFFER_ACCEPTANCE: 'Offer Acceptance',
    UPDATE_USER_INFO: 'Update User Information',
    DECLINE_OFFER: 'Declined Offer',
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

    OFFER_ACCEPTANCE: (acceptance: response)=>
        `<!DOCTYPE html>
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
         <h2>${acceptance.firstName} ${acceptance.lastName} has accepted their offer!</h2>
    </div>
     <p>Dear Admin</p>
    
    <div class="content">
        <p>${acceptance.firstName} ${acceptance.lastName} has accepted the invitation and submitted their onboarding details.</p>
        <p>You can now review their submission and finalize approval.</p>
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
     
    UPDATE_USER_INFO: (user: updateUser)=>
        `<!DOCTYPE html>
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
        <h1>Update Onboarding Information!</h1>
         <h2>Hello ${user.firstName},</h2>
    </div>
     <!-- <p> Admin</p> -->
    <div class="content">
        <!-- <p>We're excited to welcome you to Zoracom</p> -->
        <p>Thanks for submitting your onboarding details. Upon review, we need a few updates.</p>
        <p>${user.comment}.</p>
        <p>Click below to update your information. Your previous answers will be pre-filled</p>
        
        <p><a href="${user.link}" class="button">Update my Information</a></p>

        <p>Looking forward to having you fully onboarded</p>
        
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

DECLINE_OFFER: (decline: response) => 
    `<!DOCTYPE html>
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
         <h2>${decline.firstName} ${decline.lastName} Declined The Offer!</h2>
    </div>
     <p>Dear Admin</p>
    
    <div class="content">
        <!-- <p>We're excited to welcome you to Zoracom</p> -->
        <p>{firstName lastName} has declined the offer to join Zoracom.</p>
        <p>You may archive their record or reach out for clarification.</p>
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