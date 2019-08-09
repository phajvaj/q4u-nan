import { Component, OnInit, Input, Output, EventEmitter, ViewChild } from '@angular/core';
import { NgbModalRef, NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { AlertService } from '../alert.service';
import { ServiceRoomService } from '../service-room.service';
import { ModalSettingSoundComponent } from '../modal-setting-sound/modal-setting-sound.component';
import * as _ from 'lodash';
@Component({
  selector: 'app-modal-rooms',
  templateUrl: './modal-rooms.component.html',
})
export class ModalRoomsComponent implements OnInit {

  @Input('servicePointId')
  set setServicePointId(value: any) {
    this.servicePointId = value;
  }

  @Input('servicePointName')
  set setServicePointName(value: any) {
    this.servicePointName = value;
  }

  @Output('onSave') onSave: EventEmitter<any> = new EventEmitter<any>();
  @ViewChild('content') public content: any;
  @ViewChild('mdlSettingSound') private mdlSettingSound: ModalSettingSoundComponent;

  servicePointId: any;
  roomName: any;
  servicePointName: any;
  roomId: any;
  roomNumber: any;
  modalReference: NgbModalRef;
  rooms: any = [];
  roomNumbers: any = [];

  btnLabel = 'เพิ่ม';

  constructor(
    private modalService: NgbModal,
    private alertService: AlertService,
    private roomService: ServiceRoomService
  ) { }

  async ngOnInit() {
    await this.generateRoomNumber();
  }

  generateRoomNumber() {
    for (let index = 1; index <= 50; index++) {
      this.roomNumbers.push(index);
    }
  }

  open(_servicePointId: any) {

    this.getList(_servicePointId);
    this.servicePointId = _servicePointId;

    this.modalReference = this.modalService.open(this.content, {
      ariaLabelledBy: 'modal-basic-title',
      keyboard: false,
      backdrop: 'static',
      // size: 'lg',
      // centered: true
    });

    this.modalReference.result.then((result) => { });

  }

  dismiss() {
    this.modalReference.close();
  }

  async getList(_servicePointId: any) {
    try {
      const rs: any = await this.roomService.list(_servicePointId);
      if (rs.statusCode === 200) {
        this.rooms = rs.results;
      } else {
        this.alertService.error(rs.message);
      }
    } catch (error) {
      console.error(error);
      this.alertService.error('เกิดข้อผิดพลาด');
    }
  }

  edit(room: any) {
    this.roomId = room.room_id;
    this.roomName = room.room_name;
    this.roomNumber = room.room_number;
    this.btnLabel = 'ปรับปรุง';
  }

  async addRoom() {
    if (this.roomName && this.roomNumber) {
      try {
        const data = {
          roomName: this.roomName,
          servicePointId: this.servicePointId,
          roomNumber: this.roomNumber,
        };
        var rs: any = null;
        if (this.roomId) {
          rs = await this.roomService.update(this.roomId, data);
        } else {
          rs = await this.roomService.save(data);
        }
        if (rs.statusCode === 200) {
          this.alertService.success();
          this.roomName = null;
          this.roomNumber = null;
          this.roomId = null;
          this.btnLabel = 'เพิ่ม';
          this.getList(this.servicePointId);
        } else {
          this.alertService.error(rs.message);
        }
      } catch (error) {
        console.error(error);
        this.alertService.error('เกิดข้อผิดพลาด')
      }
    } else {
      this.alertService.error('กรุณากำหนดชื่อห้องตรวจ');
    }
  }

  async remove(room: any) {
    let confirm = await this.alertService.confirm(`ต้องการลบ ${room.room_name} ใช่หรือไม่?`);
    if (confirm) {
      try {
        let rs: any = await this.roomService.remove(room.room_id);
        if (rs.statusCode === 200) {
          this.alertService.success();
          this.getList(this.servicePointId);
        } else {
          this.alertService.error(rs.message);
        }
      } catch (error) {
        console.log(error);
        this.alertService.error();
      }
    }
  }

  clear() {
    this.roomName = null;
    this.roomNumber = null;
    this.roomId = null;
    this.btnLabel = 'เพิ่ม';
  }

  showModalSound(item) {
    this.servicePointId = item.service_point_id;
    this.roomId = item.room_id;
    this.mdlSettingSound.open(item);
  }

  onSaveSound(e) {
    const idx = _.findIndex(this.rooms, { 'room_id': this.roomId });
    if (idx > -1) {
      this.rooms[idx].sound_id = e;
    }
  }
}
