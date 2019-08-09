PLEASE FOLLOW THE FLOW CORRECTLY WINDOWS 10x64

Powershell run as administrator
npm install -g node-gyp
npm install --global --production windows-build-tools

#SQL UPDATE
ALTER TABLE `queue`.`q4u_service_points`
ADD COLUMN `room_queue_running` enum('Y','N') NULL DEFAULT 'N' COMMENT 'ออกเลขคิวตามห้องตรวจ' AFTER `priority_queue_running`;
