# The Chrome Extension Main Purpose

* The Chrome Extension main purpose is to retrieve data from the website manually.
* The retrieved data is sending to online database : Supabase 
* This tool is personal use, no need to focus too much on the security.
* All the module should be locally storage in ./libs, not reference online resources.
* All the code should be well-commented.
* There will be more project be integrated, always consider future proof.
* ContentScripts is the least file we want to use, if we can avoid it, we will avoid it. If it is necessary, describe the reaseon and ask for permission.

# Structure
```text
.
├── popup/
│   ├── popup.html       # The portal to each project.
│   │                    # Each project will be an Accordion Menu item.
│   │                    # Several function buttons will be shown under the Accordion Menu item.
│   ├── popup.js         # Used for popup.html
│   ├── css/             # Used for popup.html
│   └── images/          # Used for popup.html
├── contentScript/
│   └── contentScript.js # Basically we don't use it, leave its content empty.
│                        # Extension needs at least one contentScript.js to exist.
├── background/
│   ├── project_1/       # Separate each project into different folders, so it is easy to manage and maintain.
│   │   │                # Each project will be a service that can be called by popup.js.
│   │   │                # Each project will have its own data structure and logic, so it is easy to maintain.
│   │   ├── background.js# Main function for each project
│   │   ├── function_1.js# Separate each sub-function, and be called by background.js
│   │   └── function_2.js
│   ├── project_2/
│   └── project_n/
├── frontEnd/            # Some projects will need a dashboard or other web page to display data.
│   │                    # This folder is used for that purpose.
│   ├── project_1/       # Each project will have its own folder.
│   │   ├── index.html
│   │   ├── js/
│   │   ├── css/
│   │   ├── images/
│   │   └── index.js
│   ├── project_2/
│   └── project_n/
├── icons/               # Extension Icon
└── manifest.json        # Extension Manifest
```