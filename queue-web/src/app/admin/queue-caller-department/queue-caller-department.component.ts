import { Component, OnInit, OnDestroy, ViewChild, NgZone, Inject } from '@angular/core';
import * as mqttClient from '../../../vendor/mqtt';
import { MqttClient } from 'mqtt';
import * as Random from 'random-js';
import * as _ from 'lodash';

import { ModalSelectTransferComponent } from 'src/app/shared/modal-select-transfer/modal-select-transfer.component';
import { ModalSelectDepartmentComponent } from 'src/app/shared/modal-select-department/modal-select-department.component';
import { QueueService } from 'src/app/shared/queue.service';
import { AlertService } from 'src/app/shared/alert.service';
import { ServiceRoomService } from 'src/app/shared/service-room.service';

import { CountdownComponent } from 'ngx-countdown';
import { JwtHelperService } from '@auth0/angular-jwt';
import { ModalSelectRoomComponent } from 'src/app/shared/modal-select-room/modal-select-room.component';

@Component({
  selector: 'app-queue-caller-department',
  templateUrl: './queue-caller-department.component.html',
  styles: []
})
export class QueueCallerDepartmentComponent implements OnInit {

  @ViewChild('mdlServicePoint') private mdlServicePoint: ModalSelectDepartmentComponent;
  @ViewChild('mdlSelectTransfer') private mdlSelectTransfer: ModalSelectTransferComponent;
  @ViewChild('mdlSelectRoom') private mdlSelectRoom: ModalSelectRoomComponent;

  userId: any;
  message: string;
  servicePointId: any;
  servicePointName: any;
  departmentId: any;
  departmentName: any;
  queues = [];
  pendingItems: any = [];
  historyItems: any = [];
  historyTotal: any;
  rooms: any = [];
  queueNumber: any;
  roomNumber: any;
  roomId: any;
  queueId: any;

  isAllServicePoint = false;

  total = 0;
  pageSize = 10;
  maxSizePage = 5;
  currentPage = 1;
  offset = 0;

  // currentTopic: any;

  isOffline = false;

  client: MqttClient;
  jwtHelper = new JwtHelperService();
  departmentTopic = null;
  servicePointTopic = null;
  globalTopic = null;
  notifyUser = null;
  notifyPassword = null;
  isMarkPending = false;
  pendingToServicePointId: any = null;
  pendingToPriorityId: any = null;

  selectedQueue: any = {};
  notifyUrl: string;
  query: any;
  pendingOldQueue: any;

  sortQueue = 1;
  @ViewChild(CountdownComponent) counter: CountdownComponent;

  constructor(
    private queueService: QueueService,
    private roomService: ServiceRoomService,
    private alertService: AlertService,
    private zone: NgZone,
    @Inject('API_URL') private apiUrl: string,
  ) {
    const token = sessionStorage.getItem('token');
    const decodedToken = this.jwtHelper.decodeToken(token);
    this.servicePointTopic = decodedToken.SERVICE_POINT_TOPIC;
    this.departmentTopic = decodedToken.DEPARTMENT_TOPIC || 'queue/department';
    this.globalTopic = decodedToken.QUEUE_CENTER_TOPIC;
    this.userId = decodedToken.userId;

    this.notifyUrl = `ws://${decodedToken.NOTIFY_SERVER}:${+decodedToken.NOTIFY_PORT}`;
    this.notifyUser = decodedToken.NOTIFY_USER;
    this.notifyPassword = decodedToken.NOTIFY_PASSWORD;

    const _departments = JSON.parse(localStorage.getItem(`queueCallerDepartment${this.userId}`));
    if (_departments) {
      this.onSelectedDepartment(_departments);
    } else {
      const _servicePoints = JSON.parse(sessionStorage.getItem('servicePoints'));
      const _department = _.unionBy(_servicePoints, 'department_id');
      if (_department.length === 1) {
        this.onSelectedDepartment(_department[0]);
      }
    }

  }

  public unsafePublish(topic: string, message: string): void {
    try {
      this.client.end(true);
    } catch (error) {
      console.log(error);
    }
  }

  public ngOnDestroy() {
    try {
      this.client.end(true);
    } catch (error) {
      console.log(error);
    }
  }

  ngOnInit() {
    if (this.departmentId) {
      this.getAllList();
      this.connectWebSocket();
    }
  }

  connectWebSocket() {
    const rnd = new Random();
    const username = sessionStorage.getItem('username');
    const strRnd = rnd.integer(1111111111, 9999999999);
    const clientId = `${username}-${strRnd}`;

    try {
      // close old connection
      this.client.end(true);
    } catch (error) {
      // console.log(error);
    }

    this.client = mqttClient.connect(this.notifyUrl, {
      clientId: clientId,
      username: this.notifyUser,
      password: this.notifyPassword
    });

    const that = this;
    const topicServicePoint = `${this.servicePointTopic}/${this.servicePointId}`;
    const topicDepartment = `${this.departmentTopic}/${this.departmentId}`;
    const visitTopic = this.globalTopic;

    this.client.on('connect', () => {
      console.log('Connected!');
      that.zone.run(() => {
        that.isOffline = false;
      });

      if (this.servicePointId) {
        that.client.subscribe(topicServicePoint, { qos: 0 }, (error) => {
          console.log('Subscribe : ' + topicServicePoint);

          if (error) {
            that.zone.run(() => {
              that.isOffline = true;
              try {
                that.counter.restart();
              } catch (error) {
                console.log(error);
              }
            });
          }
        });
      }

      that.client.subscribe([topicDepartment, visitTopic], { qos: 0 }, (error) => {
        console.log('Subscribe : ' + topicDepartment + ', ' + visitTopic);

        if (error) {
          that.zone.run(() => {
            that.isOffline = true;
            try {
              that.counter.restart();
            } catch (error) {
              console.log(error);
            }
          });
        }
      });

    });

    this.client.on('close', () => {
      console.log('Close');
    });

    this.client.on('message', (topic, payload) => {
      this.getAllList();
    });

    this.client.on('error', (error) => {
      console.log('Error');
      that.zone.run(() => {
        that.isOffline = true;
        that.counter.restart();
      });
    });

    this.client.on('offline', () => {
      console.log('Offline');
      that.zone.run(() => {
        that.isOffline = true;
        try {
          that.counter.restart();
        } catch (error) {
          console.log(error);
        }
      });
    });
  }

  onPageChange(event: any) {
    const _currentPage = +event;
    let _offset = 0;
    if (_currentPage > 1) {
      _offset = (_currentPage - 1) * this.pageSize;
    }

    this.offset = _offset;
    this.getQueues();
  }

  onFinished() {
    console.log('Time finished!');
    this.connectWebSocket();
  }

  onNotify($event) {
    console.log('Finished');
  }

  setChangeRoom(item: any) {
    this.queueId = item.queue_id;
    this.queueNumber = item.queue_number;
  }

  async searchQuery() {
    try {
      this.offset = 0;
      const rs: any = await this.queueService.searchQueueByDepartment(this.departmentId, this.pageSize, this.offset, this.query);
      if (rs.statusCode === 200) {
        for (const i of rs.results) {
          const rm: any = await this.roomService.list(i.service_point_id);
          if (rm.statusCode === 200) {
            i.rooms = rm.results;
          }
        }
        this.queues = rs.results;
        this.total = rs.total;
        console.log(this.queues);

      } else {
        console.log(rs.message);
        this.alertService.error('เกิดข้อผิดพลาด');
      }
    } catch (error) {
      console.log(error);
      this.alertService.error();
    }
  }

  async getQueues() {
    try {
      const sort = await this.getSort(this.sortQueue);
      const rs: any = await this.queueService.getQueueByDepartment(this.departmentId, this.pageSize, this.offset, sort);
      if (rs.statusCode === 200) {
        for (const i of rs.results) {
          const rm: any = await this.roomService.list(i.service_point_id);
          if (rm.statusCode === 200) {
            i.rooms = rm.results;
          }
        }
        this.queues = rs.results;
        this.total = rs.total;
      } else {
        console.log(rs.message);
        this.alertService.error('เกิดข้อผิดพลาด');
      }
    } catch (error) {
      console.log(error);
      this.alertService.error();
    }
  }

  async getHistory() {
    try {
      const rs: any = await this.queueService.getHistoryQueueByDepartment(this.departmentId, this.pageSize, this.offset);
      if (rs.statusCode === 200) {
        for (const i of rs.results) {
          const rm: any = await this.roomService.list(i.service_point_id);
          if (rm.statusCode === 200) {
            i.rooms = rm.results;
          }
        }
        this.historyItems = rs.results;
        this.historyTotal = rs.total;
      } else {
        console.log(rs.message);
        this.alertService.error('เกิดข้อผิดพลาด');
      }
    } catch (error) {
      console.log(error);
      this.alertService.error();
    }
  }

  async getPending() {
    try {
      const rs: any = await this.queueService.getPendingByDepartment(this.departmentId);
      if (rs.statusCode === 200) {
        this.pendingItems = rs.results;
      } else {
        console.log(rs.message);
        this.alertService.error('เกิดข้อผิดพลาด');
      }
    } catch (error) {
      console.log(error);
      this.alertService.error();
    }
  }


  selectDepartment() {
    this.isMarkPending = false;
    this.mdlServicePoint.open(false);
  }

  showSelectPointForMarkPending(item: any) {
    this.selectedQueue = item;
    this.isMarkPending = true;
    this.mdlSelectTransfer.open(true);
  }

  onSelectedDepartment(event: any) {
    if (event) {
      localStorage.setItem(`queueCallerDepartment${this.userId}`, JSON.stringify(event));
      this.departmentId = event.department_id;
      this.departmentName = event.department_name;
      this.connectWebSocket();
      this.getAllList();
    }
  }

  onSelectedTransfer(event: any) {
    this.pendingToServicePointId = event.servicePointId;
    this.pendingToPriorityId = event.priorityId;
    this.pendingOldQueue = event.pendingOldQueue;

    this.doMarkPending(this.selectedQueue);
  }

  async doMarkPending(item: any) {
    if (this.servicePointId === this.pendingToServicePointId) {
      this.alertService.error('ไม่สามารถสร้างคิวในแผนกเดียวกันได้');
    } else {
      const _confirm = await this.alertService.confirm(`ต้องการส่งต่อคิว [${item.queue_number}] และพิมพ์บัตรคิว ใช่หรือไม่?`);
      if (_confirm) {
        try {
          const rs: any = await this.queueService.markPending(
            item.queue_id,
            this.pendingToServicePointId,
            this.pendingToPriorityId,
            this.pendingOldQueue);

          if (rs.statusCode === 200) {
            this.alertService.success();
            this.selectedQueue = {};
            this.isMarkPending = false;
            const queueNumber = rs.queueNumber;
            const newQueueId = rs.queueId;
            // var confirm = await this.alertService.confirm(`คิวใหม่ของคุณคือ ${queueNumber} ต้องการพิมพ์บัตรคิว หรือไม่?`);
            // if (confirm) {
            this.printQueue(newQueueId);
            // }
            this.getAllList();
          } else {
            this.alertService.error(rs.message);
          }
        } catch (error) {
          console.log(error);
          this.alertService.error();
        }
      }
    }
  }


  getAllList() {
    this.getQueues();
    this.getPending();
    this.getHistory();
  }


  setCallDetail(item: any) {
    this.queueId = item.queue_id;
    this.queueNumber = item.queue_number;
    this.roomId = item.rooms[0].room_id;
    this.roomNumber = item.rooms[0].room_number;
    this.servicePointId = item.service_point_id;
    this.doCallQueue();
    // }
  }

  setQueueForCall(queue: any) {
    this.roomNumber = queue.room_number;
    this.roomId = queue.room_id;
    this.queueNumber = queue.queue_number;
    this.queueId = queue.queue_id;
    this.rooms = queue.rooms;
    this.servicePointId = queue.service_point_id;
  }

  prepareQueue(room: any) {
    this.roomId = room.room_id;
    this.roomNumber = room.room_number;
    console.log(this.roomId, this.roomNumber, this.queueNumber, this.queueId);
    this.doCallQueue();
  }

  onSelectRoom(item) {
    this.prepareQueue({ 'room_id': item.roomId, 'room_number': item.roomNumber });
  }

  async doCallQueue(isCompleted: any = 'Y') {
    if (this.isOffline) {
      this.alertService.error('กรุณาตรวจสอบการเชื่อมต่อกับ Notify Server');
    } else {
      try {
        // const rs: any = await this.queueService.callQueue(this.servicePointId, this.queueNumber, this.roomId, this.roomNumber, this.queueId, isCompleted);
        const rs: any = await this.queueService.callQueueDepartment(this.departmentId, this.servicePointId, this.queueNumber, this.roomId, this.roomNumber, this.queueId, isCompleted);
        console.log(rs);

        if (rs.statusCode === 200) {
          this.alertService.success();
          this.getAllList();
          this.roomId = null;
          this.roomNumber = null;
          this.queueNumber = null;
          this.queueId = null;
        } else {
          this.alertService.error(rs.message);
        }
      } catch (error) {
        console.error(error);
        this.alertService.error('เกิดข้อผิดพลาด');
      }
    }
  }

  async printQueue(queueId: any) {
    const usePrinter = localStorage.getItem('clientUserPrinter');
    const printerId = localStorage.getItem('clientPrinterId');
    const printSmallQueue = localStorage.getItem('printSmallQueue') || 'N';

    if (usePrinter === 'Y') {
      const topic = `/printer/${printerId}`;
      try {
        const rs: any = await this.queueService.printQueueGateway(queueId, topic, printSmallQueue);
        if (rs.statusCode === 200) {
        } else {
          this.alertService.error('ไม่สามารถพิมพ์บัตรคิวได้');
        }
      } catch (error) {
        console.log(error);
        this.alertService.error('ไม่สามารถพิมพ์บัตรคิวได้');
      }
      //
    } else {
      window.open(`${this.apiUrl}/print/queue?queueId=${queueId}`, '_blank');
    }
  }

  async openModalSelectRoom(item) {

    this.setQueueForCall(item);
    this.mdlSelectRoom.setList(item.rooms);
    this.mdlSelectRoom.open();
  }

  onClickSortQueue() {
    if (this.sortQueue === 3) {
      this.sortQueue = 1;
    } else {
      this.sortQueue += 1;
    }
    this.getQueues();
  }

  getSort(id) {
    if (id === 2) {
      return 'ASC';
    } else if (id === 3) {
      return 'DESC';
    } else {
      return '';
    }
  }
}
