# gbs-SceneStackExPlugin
Extended Scene stack plugin for GBStudio (Requires GBStudio 4.2.0 Beta3)

Saving the scene in stack in GBStudio only saves the scene address and the Player position into the stack.
This plugin adds an extanded version saving the scene to the stack which puts pretty much everything from the scene.
The plugin also adds failsafes when exceeding the stack or trying to pop an empty stack to the default scene stack and the extended scene stack.

Limitations: 
- Due to the large size of a single scene stack, the extended scene stacks can push up to 2 scenes on the stack. (the default scene stack is still useable and can stack up to 8 scenes)
- Some things cannot be stack and must be managed on the user hand and initialize those things in the "onPop" section of the extended scene push event. Said things are usualy related to VRAM changes, such as replacing an actor spritesheet, submapping, tileswapping, etc.

Events:
Push scene state to stack (EXTENDED)
The extended version of Store current scene on stack, It will push the current scene on stack, any script in the "On push" tab will be run after the scene was pushed on stack but will not be run when the stack is popped.
Script in the "On pop" will be run when the stack is popped. The behavior is akin to the saving functionality. If you plan to put scripts in the "on pop" make sure to put in a Fade in event in it.

<img width="669" height="170" alt="image" src="https://github.com/user-attachments/assets/aa09dae9-3cc4-4664-9e0f-28147c34f8a2" />

Get scene stack count (EXTENDED)
Store in a variable the amount of scenes that are currently pushed to the extended scene stack, there is also a non-extended version for the default scene stack.

<img width="664" height="95" alt="image" src="https://github.com/user-attachments/assets/a14d58f7-23c3-4ef7-840e-a15a49c49f8b" />

Pop the top scene state from stack (EXTENDED)
The extended version of Restore Previous Scene From Stack. It will pop the last scene pushed on stack. Setting the fade speed to Instant will make it so that there will be no fade out during the scene change.

<img width="665" height="120" alt="image" src="https://github.com/user-attachments/assets/b74153c9-40a9-4bdf-8e11-b3ab46240041" />

Pop all scene state from stack (EXTENDED)
The extended version of Restore First Scene From Stack. It will pop all scenes from stack except from the first one and switch to that one. Setting the fade speed to Instant will make it so that there will be no fade out during the scene change.

<img width="669" height="120" alt="image" src="https://github.com/user-attachments/assets/6334bc62-c114-4cec-85e4-caba35227665" />

Clears the stack of saved scene states (EXTENDED)
Clears the extended scene stacks.
<img width="667" height="68" alt="image" src="https://github.com/user-attachments/assets/32ef1751-2d63-44ed-bc38-38ed84ca5484" />
