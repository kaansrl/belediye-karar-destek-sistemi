# Belediye Karar Destek Sistemi

Bu proje, belediye düzeyinde hizmet planlamasını desteklemek amacıyla geliştirilmiş bir karar destek sistemidir. Sistem; mahalle bazında analiz yaparak eğitim, sağlık ve park hizmetleri için erişilebilirlik skorları üretir.

---

## Amaç

Farklı hizmet türleri için mahallelerin mevcut durumunu analiz etmek ve yapılacak yatırımların hangi bölgelerde daha fazla iyileşme sağlayacağını belirlemek.

---

## Temel Özellikler

- Mahalle bazlı skor hesaplama (0–100 arası)
- Eğitim, sağlık ve park hizmetleri için ayrı analiz
- Alt tür desteği (örneğin: ilkokul, lise, hastane vb.)
- Harita üzerinde görselleştirme (renk tabanlı)
- Seçilen noktaya göre yatırım simülasyonu
- En uygun yatırım noktalarını önerme
- Senaryo kaydetme ve karşılaştırma
- CSV çıktı alma
- Rol bazlı kullanıcı sistemi (viewer / analyst / admin)

---

## Kullanılan Teknolojiler

### Backend
- Node.js (Express)
- PostgreSQL + PostGIS

### Frontend
- React
- Leaflet

### Veri
- OpenStreetMap (OSM)

---

## Sistem Nasıl Çalışır?

Sistem, mahalleler için aşağıdaki verileri kullanır:

- Nüfus yoğunluğu  
- En yakın hizmet noktalarına mesafe  
- Hizmet türü ve alt tür bilgileri  

Bu veriler Min-Max normalizasyonu ile ölçeklenir ve ağırlıklandırılarak mahalle skorları elde edilir.

Yapılan bir yatırım simülasyonunda:
- Seçilen noktaya olan mesafe hesaplanır
- Yeni skorlar üretilir
- Önce / sonra farkı analiz edilir

---

## Ekran Görüntüleri

### Genel Harita Görünümü
<img width="1805" height="729" alt="image" src="https://github.com/user-attachments/assets/f9e07303-0b2e-42a2-a38f-7591bd4bc1a2" />



### Tür ve Alt Tür Seçimi
<img width="1817" height="743" alt="image" src="https://github.com/user-attachments/assets/ae5a88ad-5947-4517-a14c-16ef15bf36d0" />
<img width="1824" height="756" alt="image" src="https://github.com/user-attachments/assets/753b0e24-1743-4d33-818e-69037e30df3d" />
<img width="1862" height="799" alt="image" src="https://github.com/user-attachments/assets/10b3aa70-abc8-4dc6-b2d2-fc761cc4a8c8" />



### Simülasyon Sonucu
<img width="1796" height="733" alt="image" src="https://github.com/user-attachments/assets/d1bf506d-6468-4679-9d72-6e67aa62f397" />



### Öneri Noktaları
<img width="1332" height="702" alt="image" src="https://github.com/user-attachments/assets/03aaa4c3-cebe-44d2-be6f-61a50e12d4e1" />


### Senaryo Karşılaştırma
<img width="1796" height="793" alt="image" src="https://github.com/user-attachments/assets/94559fc0-45cd-4ce6-ba5b-f830728f18e7" />
<img width="1750" height="854" alt="image" src="https://github.com/user-attachments/assets/d2ad1ae0-d01c-4d12-aa4c-717fdda75480" />


---


## Notlar

- Mesafe hesaplamaları kuş uçuşu olarak yapılmaktadır  
- Veri kaynağı OSM olduğu için bazı eksiklikler olabilir  
- Sistem karar destek amaçlıdır, kesin sonuç üretmez  

---

## Sonuç

Bu sistem, belediyelerin hizmet planlama süreçlerinde veri odaklı kararlar almasına yardımcı olacak şekilde tasarlanmıştır.
