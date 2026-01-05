// services/frontend/src/pages/Admin/Certificates/index.jsx
import React from 'react';
import { Routes, Route } from 'react-router-dom';
import CertificatesList from './CertificatesList';
import CertificateDetail from './CertificateDetail';
import CertificateUpload from './CertificateUpload';
import CertificateRenew from './CertificateRenew';

const Certificates = () => {
  return (
    <Routes>
      <Route index element={<CertificatesList />} />
      <Route path="upload" element={<CertificateUpload />} />
      <Route path=":id" element={<CertificateDetail />} />
      <Route path=":id/renew" element={<CertificateRenew />} />
    </Routes>
  );
};

export default Certificates;